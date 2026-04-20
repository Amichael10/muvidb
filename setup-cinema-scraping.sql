-- ============================================================
-- setup-cinema-scraping.sql  —  Run ONCE in Supabase → SQL Editor
-- ============================================================
-- Prerequisite: setup-youtube.sql already ran (pg_cron + pg_net enabled).
--
-- This file wires up the cinema showtime scraping pipeline:
--   1. Adds scraper-tracking columns to the cinemas table
--   2. Ensures showtimes has the columns + unique index we upsert on
--   3. Enables pg_trgm for fuzzy film-title matching
--   4. Schedules a 1×/day cron at 7am WAT (6am UTC) hitting /api/cron/refresh-showtimes
--
-- REPLACE `YOUR_VERCEL_URL` before running the cron section.
-- ============================================================

-- ── 1. Cinemas — scrape metadata ─────────────────────────────
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS scrape_enabled         boolean     DEFAULT false;
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS scrape_adapter         text;        -- 'reach_cinema' | 'veezi' | 'cinesync' | 'bluepictures' | 'firecrawl'
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS scrape_config          jsonb       DEFAULT '{}'::jsonb;  -- { siteToken, circuitId, externalCinemaId, slug, ... }
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS showtimes_last_fetched_at timestamptz;
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS scrape_failure_count   int         DEFAULT 0;
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS scrape_last_error      text;

-- Helpful index for the cron's "who needs a refresh?" query
CREATE INDEX IF NOT EXISTS cinemas_scrape_enabled_idx
  ON cinemas (scrape_enabled, showtimes_last_fetched_at)
  WHERE scrape_enabled = true;

-- ── 2. Showtimes — ensure required columns + upsert index ────
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS format       text    DEFAULT 'Standard';
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS ticket_url   text;
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS is_available boolean DEFAULT true;
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS source       text    DEFAULT 'manual';        -- which adapter wrote this row
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now();        -- bumped every scrape
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS price        numeric(10,2);
ALTER TABLE showtimes ADD COLUMN IF NOT EXISTS screen_name  text;

-- Enforce NOT NULL on format so the unique index can be a plain tuple
-- (supabase-js upsert onConflict can't match expression indexes like COALESCE(...))
UPDATE showtimes SET format = 'Standard' WHERE format IS NULL;
ALTER TABLE showtimes ALTER COLUMN format SET DEFAULT 'Standard';
ALTER TABLE showtimes ALTER COLUMN format SET NOT NULL;

-- Deduplicate existing rows before creating the unique index
DELETE FROM showtimes WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY cinema_id, film_id, show_date, show_time, format
      ORDER BY created_at NULLS LAST, id
    ) AS rn FROM showtimes
  ) r WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS showtimes_cinema_film_date_time_fmt_uidx
  ON showtimes (cinema_id, film_id, show_date, show_time, format);

-- Fast reads for the CinemaDetail page ("give me this cinema's next 7 days")
CREATE INDEX IF NOT EXISTS showtimes_cinema_date_idx
  ON showtimes (cinema_id, show_date)
  WHERE is_available = true;

-- ── 3. Fuzzy film-title matching ────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram GIN index on normalized title → fast similarity() lookups
CREATE INDEX IF NOT EXISTS films_title_trgm_idx
  ON films USING gin (lower(title) gin_trgm_ops);

-- ── 4. Schedule cron: 1×/day at 7am WAT (= 6am UTC) ─────────
-- !! REPLACE YOUR_VERCEL_URL below before running this block !!
-- Remove the old job if it exists (safe no-op on first run)
SELECT cron.unschedule('refresh-showtimes-7am') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-showtimes-7am'
);

SELECT cron.schedule(
  'refresh-showtimes-7am', '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://YOUR_VERCEL_URL/api/cron/refresh-showtimes',
    headers := '{"x-cron-secret":"lumi-cron-pkenrm-2026","Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $cron$
);

-- ── 5. Verify ───────────────────────────────────────────────
-- SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'refresh-%';
-- SELECT COUNT(*) FILTER (WHERE scrape_enabled) AS enabled_cinemas FROM cinemas;
