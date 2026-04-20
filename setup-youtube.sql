-- ============================================================
-- setup-youtube.sql  —  Run ONCE in Supabase → SQL Editor
-- ============================================================

-- ── 1. People — add columns that the DB is missing ────────
ALTER TABLE people ADD COLUMN IF NOT EXISTS biography  text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS birthplace text;
ALTER TABLE people ADD COLUMN IF NOT EXISTS source     text DEFAULT 'manual';
ALTER TABLE people ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;

-- ── 2. Films — add YouTube / enrichment columns ───────────
ALTER TABLE films ADD COLUMN IF NOT EXISTS source            text    DEFAULT 'manual';
ALTER TABLE films ADD COLUMN IF NOT EXISTS source_video_id   text;
ALTER TABLE films ADD COLUMN IF NOT EXISTS needs_review      boolean DEFAULT false;
ALTER TABLE films ADD COLUMN IF NOT EXISTS youtube_watch_url text;

-- Make language nullable (spreadsheet has many NULLs)
ALTER TABLE films ALTER COLUMN language DROP NOT NULL;
ALTER TABLE films ALTER COLUMN language SET DEFAULT 'English';

-- Allow film_status values used in the spreadsheet
-- (safe no-op if value already exists)
DO $$ BEGIN
  ALTER TYPE film_status ADD VALUE IF NOT EXISTS 'post-production';
EXCEPTION WHEN others THEN NULL; END $$;

-- Unique index so two cron runs never create a duplicate film for the same video
CREATE UNIQUE INDEX IF NOT EXISTS films_source_video_id_uidx
  ON films (source_video_id)
  WHERE source_video_id IS NOT NULL;

-- ── 3. Credits — relax NOT NULL on billing_order ──────────
ALTER TABLE credits ALTER COLUMN billing_order DROP NOT NULL;
ALTER TABLE credits ALTER COLUMN billing_order SET DEFAULT 0;

-- Deduplicate credits before creating unique index:
-- Keep the row with the lowest ctid (physical insertion order) for each duplicate group
DELETE FROM credits
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY film_id, person_id, role
             ORDER BY ctid
           ) AS rn
    FROM credits
  ) ranked
  WHERE rn > 1
);

-- Now safe to create the unique index
CREATE UNIQUE INDEX IF NOT EXISTS credits_film_person_role_uidx
  ON credits (film_id, person_id, role);

-- ── 4. Channel_videos — add new columns ───────────────────
ALTER TABLE channel_videos ADD COLUMN IF NOT EXISTS is_hidden        boolean       DEFAULT false;
ALTER TABLE channel_videos ADD COLUMN IF NOT EXISTS description      text;
ALTER TABLE channel_videos ADD COLUMN IF NOT EXISTS match_confidence numeric(4,3);

-- ── 5. Cinemas — add booking_url ──────────────────────────
ALTER TABLE cinemas ADD COLUMN IF NOT EXISTS booking_url text;

-- ── 6. Enable extensions ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── 7. Cron jobs (WAT = UTC+1) ────────────────────────────
-- 7am WAT  = 6am  UTC  |  1pm WAT = 12pm UTC  |  5pm WAT = 4pm UTC
--
-- !! Replace YOUR_VERCEL_URL and YOUR_CRON_SECRET before running !!
-- YOUR_CRON_SECRET = lumi-cron-pkenrm-2026

SELECT cron.schedule(
  'refresh-videos-7am', '0 6 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://YOUR_VERCEL_URL/api/cron/refresh-videos',
    headers := '{"x-cron-secret":"lumi-cron-pkenrm-2026","Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'refresh-videos-1pm', '0 12 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://YOUR_VERCEL_URL/api/cron/refresh-videos',
    headers := '{"x-cron-secret":"lumi-cron-pkenrm-2026","Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $cron$
);

SELECT cron.schedule(
  'refresh-videos-5pm', '0 16 * * *',
  $cron$
  SELECT net.http_post(
    url     := 'https://YOUR_VERCEL_URL/api/cron/refresh-videos',
    headers := '{"x-cron-secret":"lumi-cron-pkenrm-2026","Content-Type":"application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $cron$
);

-- ── 8. Verify jobs were created ───────────────────────────
-- SELECT jobname, schedule, command FROM cron.job;

-- ── 9. Remove jobs if needed ──────────────────────────────
-- SELECT cron.unschedule('refresh-videos-7am');
-- SELECT cron.unschedule('refresh-videos-1pm');
-- SELECT cron.unschedule('refresh-videos-5pm');
