-- Migration: 20261112131928_rewind_2026_snapshot.sql
-- Description: MuviDB Rewind 2026 — per-actor year-in-review snapshot, the
--              event log behind the share page, and build_rewind_2026(cutoff)
--              which fills the snapshot from approved credits.
--
-- Nothing here is user-facing until the /rewind routes are un-gated on
-- 2026-12-02. The snapshot is re-runnable: build_rewind_2026() is an upsert and
-- deliberately preserves video_url / story_png_url / feed_png_url unless the
-- actor's stats actually moved, so a re-run the morning of launch does not
-- throw away a GitHub Actions render that is still correct.


-- ---------------------------------------------------------------------------
-- 1. Snapshot table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewind_2026 (
  person_id          UUID PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  slug               TEXT NOT NULL,
  display_name       TEXT NOT NULL,
  portrait_url       TEXT,

  -- Credit counts. films_count is screen work; plays_count is 2026 stage work,
  -- which only ever counts for someone who also has a 2026 film credit.
  films_count        INTEGER NOT NULL DEFAULT 0,
  plays_count        INTEGER NOT NULL DEFAULT 0,
  lead_count         INTEGER NOT NULL DEFAULT 0,
  support_count      INTEGER NOT NULL DEFAULT 0,
  -- How many film credits carry a usable billing_order. 49.5% of 2026 actor
  -- credits store the sentinel 99 ("unknown") that the admin UI writes, so
  -- lead/support are only meaningful relative to this. The card hides the
  -- lead/supporting pills entirely when it is 0.
  lead_known_count   INTEGER NOT NULL DEFAULT 0,

  total_views        BIGINT  NOT NULL DEFAULT 0,
  hours_on_screen    INTEGER NOT NULL DEFAULT 0,

  top_film_id        UUID REFERENCES public.films(id) ON DELETE SET NULL,
  top_film_views     BIGINT,
  top_play_id        UUID REFERENCES public.plays(id) ON DELETE SET NULL,

  -- Box office across their 2026 films and plays. Sparse by nature — only 179
  -- of the eligible actors have a non-zero total — so the page hides the row
  -- rather than printing a zero.
  box_office_total   NUMERIC(14,2),
  box_office_currency TEXT,

  top_costar_id      UUID REFERENCES public.people(id) ON DELETE SET NULL,
  top_costar_films   INTEGER,
  top_director_id    UUID REFERENCES public.people(id) ON DELETE SET NULL,
  top_director_films INTEGER,

  followers          INTEGER NOT NULL DEFAULT 0,
  -- Share of 2026 actors this person out-credited, 0..100.
  percentile         NUMERIC(5,2),

  archetype          TEXT,
  archetype_line     TEXT,
  poster_urls        TEXT[] NOT NULL DEFAULT '{}',

  eligible           BOOLEAN NOT NULL DEFAULT FALSE,

  -- Render outputs, written back by scripts/rewind-render.ts.
  video_url          TEXT,
  story_png_url      TEXT,
  feed_png_url       TEXT,
  rendered_at        TIMESTAMPTZ,

  -- Fingerprint of everything the video draws. When it changes, the three URLs
  -- above are cleared so the render job picks the actor up again.
  stats_hash         TEXT,
  snapshot_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS rewind_2026_slug_key ON public.rewind_2026 (slug);
-- The hub page lists eligible rows by reach; the render job scans for unrendered ones.
CREATE INDEX IF NOT EXISTS rewind_2026_eligible_views_idx
  ON public.rewind_2026 (total_views DESC) WHERE eligible;
CREATE INDEX IF NOT EXISTS rewind_2026_pending_render_idx
  ON public.rewind_2026 (snapshot_at) WHERE eligible AND video_url IS NULL;

ALTER TABLE public.rewind_2026 ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rewind_2026_public_read ON public.rewind_2026;
CREATE POLICY rewind_2026_public_read ON public.rewind_2026
  FOR SELECT TO anon, authenticated
  USING (eligible);

DROP POLICY IF EXISTS rewind_2026_service_write ON public.rewind_2026;
CREATE POLICY rewind_2026_service_write ON public.rewind_2026
  FOR ALL TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- A policy alone grants nothing — filmmaker_portfolios had perfect RLS and no
-- GRANT and silently read empty for days. Table-level SELECT is deliberate
-- here: every column is public-facing, so there is nothing to carve out, and a
-- column-level grant would make `select *` 401 for anon.
GRANT SELECT ON public.rewind_2026 TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 2. Event log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rewind_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       TEXT NOT NULL,
  event      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT rewind_events_event_check CHECK (event IN (
    'view', 'play', 'download_video', 'download_story', 'download_feed',
    'share_whatsapp', 'copy_link', 'claim_click'
  ))
);

CREATE INDEX IF NOT EXISTS rewind_events_slug_idx ON public.rewind_events (slug, created_at DESC);

ALTER TABLE public.rewind_events ENABLE ROW LEVEL SECURITY;

-- Insert-only for the public: the page writes its own analytics with the anon
-- key, and nobody but an admin can read the log back.
DROP POLICY IF EXISTS rewind_events_public_insert ON public.rewind_events;
CREATE POLICY rewind_events_public_insert ON public.rewind_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    event IN ('view', 'play', 'download_video', 'download_story', 'download_feed',
              'share_whatsapp', 'copy_link', 'claim_click')
    AND EXISTS (SELECT 1 FROM public.rewind_2026 r WHERE r.slug = rewind_events.slug AND r.eligible)
  );

DROP POLICY IF EXISTS rewind_events_admin_read ON public.rewind_events;
CREATE POLICY rewind_events_admin_read ON public.rewind_events
  FOR SELECT TO authenticated
  USING (public.is_admin());

GRANT INSERT ON public.rewind_events TO anon, authenticated;
GRANT SELECT ON public.rewind_events TO authenticated;


-- ---------------------------------------------------------------------------
-- 3. View formatter — 48.2M / 920K / 8,400
--    Shared by the archetype lines here and the Remotion template, so both
--    render the same string.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rewind_fmt_views(n BIGINT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN n IS NULL        THEN NULL
    WHEN n >= 1000000     THEN trim(to_char(n / 1000000.0, 'FM999990.0')) || 'M'
    WHEN n >= 10000       THEN trim(to_char(n / 1000.0,    'FM999990'))   || 'K'
    ELSE                       trim(to_char(n,             'FM999,999'))
  END;
$$;


-- ---------------------------------------------------------------------------
-- 4. build_rewind_2026(cutoff)
--
--    Fills public.rewind_2026 from approved credits only (public.credits IS
--    the approved table — public.credit_candidates is the pending queue) for
--    work released in 2026 up to p_cutoff. Safe to re-run.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.build_rewind_2026(p_cutoff DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (rows_total INTEGER, rows_eligible INTEGER, rows_needing_render INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- ---- Tunables. Change these, re-run, done. -----------------------------
  k_year_start        CONSTANT DATE    := DATE '2026-01-01';
  k_min_credits       CONSTANT INTEGER := 3;     -- films + qualifying plays
  k_min_poster_ratio  CONSTANT NUMERIC := 0.80;
  k_max_posters       CONSTANT INTEGER := 14;    -- poster burst length
  k_lead_billing_max  CONSTANT INTEGER := 2;     -- billing_order <= this is a lead
  k_unknown_billing   CONSTANT INTEGER := 99;    -- sentinel the admin UI writes
  k_workhorse_pctile  CONSTANT NUMERIC := 0.90;  -- of the >= k_min_credits cohort
  k_lead_ratio        CONSTANT NUMERIC := 0.60;
  k_loyalist_min      CONSTANT INTEGER := 4;     -- films with one director
  k_stealer_lead_max  CONSTANT NUMERIC := 0.50;  -- "mostly supporting"
  -- ------------------------------------------------------------------------
  v_workhorse_min  INTEGER;
  v_median_vpf     NUMERIC;
  v_total          INTEGER;
  v_eligible       INTEGER;
  v_needs_render   INTEGER;
BEGIN
  -- ON COMMIT DROP handles the normal case; these guard a second call inside
  -- one transaction, which would otherwise fail on "relation already exists".
  DROP TABLE IF EXISTS _win, _ac, _sp, _agg, _row, _final, _out;

  -- The 2026 window. Three ways in, because we do not store a Nigerian cinema
  -- release date: a dated 2026 release; an undated film stamped year = 2026;
  -- or anything that actually played a cinema screen in 2026.
  CREATE TEMP TABLE _win ON COMMIT DROP AS
  SELECT f.id, f.title, f.poster_url, f.view_count, f.runtime_minutes,
         f.box_office_domestic, f.box_office_worldwide, f.box_office_currency
  FROM public.films f
  WHERE f.is_published
    AND (
         (f.release_date IS NOT NULL AND f.release_date >= k_year_start AND f.release_date <= p_cutoff)
      OR (f.release_date IS NULL AND f.year = 2026)
      OR EXISTS (
           SELECT 1 FROM public.showtimes s
           WHERE s.film_id = f.id
             AND s.show_date >= k_year_start AND s.show_date <= p_cutoff
         )
    );
  CREATE UNIQUE INDEX ON _win (id);

  -- One row per (person, film): the same actor is sometimes credited twice on
  -- one title by different harvesters. Keep the best billing we have.
  CREATE TEMP TABLE _ac ON COMMIT DROP AS
  SELECT DISTINCT ON (c.person_id, c.film_id)
         c.person_id, c.film_id,
         NULLIF(c.billing_order, k_unknown_billing) AS billing_order
  FROM public.credits c
  JOIN _win w ON w.id = c.film_id
  WHERE c.role = 'actor'
  ORDER BY c.person_id, c.film_id, c.billing_order NULLS LAST;
  CREATE INDEX ON _ac (person_id);
  CREATE INDEX ON _ac (film_id);

  -- 2026 stage work, but only for people who also have a 2026 film credit.
  CREATE TEMP TABLE _sp ON COMMIT DROP AS
  SELECT DISTINCT sc.person_id, sc.play_id, p.poster_url, p.box_office_domestic,
         p.box_office_currency
  FROM public.stage_credits sc
  JOIN public.plays p ON p.id = sc.play_id
  WHERE p.year = 2026
    AND sc.role ~* '(actor|actress|cast)'
    AND (p.run_start_date IS NULL OR p.run_start_date <= p_cutoff)
    AND EXISTS (SELECT 1 FROM _ac a WHERE a.person_id = sc.person_id);
  CREATE INDEX ON _sp (person_id);

  -- Per-person aggregate over both.
  CREATE TEMP TABLE _agg ON COMMIT DROP AS
  WITH film_side AS (
    SELECT a.person_id,
           COUNT(*)::INTEGER                                              AS films_count,
           COUNT(*) FILTER (WHERE a.billing_order IS NOT NULL)::INTEGER   AS lead_known_count,
           COUNT(*) FILTER (WHERE a.billing_order <= k_lead_billing_max)::INTEGER AS lead_count,
           COUNT(*) FILTER (WHERE a.billing_order > k_lead_billing_max)::INTEGER  AS support_count,
           COALESCE(SUM(w.view_count), 0)::BIGINT                         AS total_views,
           COUNT(*) FILTER (WHERE w.poster_url IS NOT NULL)::INTEGER      AS film_posters,
           COALESCE(SUM(w.runtime_minutes), 0)::INTEGER                   AS total_minutes,
           COALESCE(SUM(COALESCE(w.box_office_domestic, w.box_office_worldwide)), 0)::NUMERIC AS film_box_office,
           MAX(w.box_office_currency) FILTER (WHERE w.box_office_domestic IS NOT NULL
                                                 OR w.box_office_worldwide IS NOT NULL) AS film_currency
    FROM _ac a JOIN _win w ON w.id = a.film_id
    GROUP BY a.person_id
  ),
  stage_side AS (
    SELECT s.person_id,
           COUNT(*)::INTEGER                                           AS plays_count,
           COUNT(*) FILTER (WHERE s.poster_url IS NOT NULL)::INTEGER   AS play_posters,
           COALESCE(SUM(s.box_office_domestic), 0)::NUMERIC            AS play_box_office,
           MAX(s.box_office_currency) FILTER (WHERE s.box_office_domestic IS NOT NULL) AS play_currency
    FROM _sp s GROUP BY s.person_id
  )
  SELECT f.person_id,
         f.films_count, f.lead_known_count, f.lead_count, f.support_count,
         f.total_views, f.total_minutes,
         COALESCE(st.plays_count, 0)                          AS plays_count,
         f.films_count + COALESCE(st.plays_count, 0)          AS credits_count,
         f.film_posters + COALESCE(st.play_posters, 0)        AS posters_count,
         NULLIF(f.film_box_office + COALESCE(st.play_box_office, 0), 0) AS box_office_total,
         COALESCE(f.film_currency, st.play_currency)          AS box_office_currency
  FROM film_side f
  LEFT JOIN stage_side st ON st.person_id = f.person_id;
  CREATE UNIQUE INDEX ON _agg (person_id);

  -- Workhorse threshold: top 10% WITHIN the cohort that clears the credit bar.
  -- Measured against everyone with a 2026 credit it lands at 4 films, which
  -- would make four actors in five a Workhorse and starve every later rule.
  SELECT percentile_cont(k_workhorse_pctile::DOUBLE PRECISION)
           WITHIN GROUP (ORDER BY credits_count::DOUBLE PRECISION)
    INTO v_workhorse_min
  FROM _agg WHERE credits_count >= k_min_credits;

  SELECT percentile_cont(0.5)
           WITHIN GROUP (ORDER BY (total_views::NUMERIC / NULLIF(films_count, 0))::DOUBLE PRECISION)
    INTO v_median_vpf
  FROM _agg WHERE credits_count >= k_min_credits;

  -- Everything the row needs, assembled once.
  CREATE TEMP TABLE _row ON COMMIT DROP AS
  WITH first_credit AS (
    -- Earliest release year across an actor's whole filmography, for Breakout.
    SELECT c.person_id,
           MIN(COALESCE(EXTRACT(YEAR FROM f.release_date)::INTEGER, f.year)) AS first_year
    FROM public.credits c
    JOIN public.films f ON f.id = c.film_id
    WHERE c.role = 'actor'
      AND EXISTS (SELECT 1 FROM _agg g WHERE g.person_id = c.person_id)
    GROUP BY c.person_id
  ),
  followers AS (
    SELECT fo.person_id, COUNT(*)::INTEGER AS followers
    FROM public.follows fo
    WHERE EXISTS (SELECT 1 FROM _agg g WHERE g.person_id = fo.person_id)
    GROUP BY fo.person_id
  ),
  ranked AS (
    -- Percentile is deliberately measured against EVERY actor with a 2026
    -- credit, not the eligible cohort: "more films than 84% of actors" is the
    -- claim the video makes, and that is the population it is about.
    SELECT g.person_id,
           ROUND((PERCENT_RANK() OVER (ORDER BY g.credits_count))::NUMERIC * 100, 0) AS percentile
    FROM _agg g
  )
  SELECT
    g.person_id,
    p.slug,
    p.name                                     AS display_name,
    p.photo_url                                AS portrait_url,
    g.films_count, g.plays_count, g.credits_count,
    g.lead_count, g.support_count, g.lead_known_count,
    g.total_views,
    ROUND(g.total_minutes / 60.0)::INTEGER     AS hours_on_screen,
    g.box_office_total, g.box_office_currency,
    tf.film_id                                 AS top_film_id,
    tf.view_count                              AS top_film_views,
    tp.play_id                                 AS top_play_id,
    tc.costar_id                               AS top_costar_id,
    tc.n                                       AS top_costar_films,
    td.director_id                             AS top_director_id,
    td.n                                       AS top_director_films,
    COALESCE(fl.followers, 0)                  AS followers,
    r.percentile,
    fc.first_year,
    posters.urls                               AS poster_urls,
    (g.credits_count >= k_min_credits
      AND p.slug IS NOT NULL
      AND p.photo_url IS NOT NULL
      AND g.posters_count::NUMERIC / g.credits_count >= k_min_poster_ratio) AS eligible
  FROM _agg g
  JOIN public.people p ON p.id = g.person_id
  LEFT JOIN ranked r      ON r.person_id = g.person_id
  LEFT JOIN first_credit fc ON fc.person_id = g.person_id
  LEFT JOIN followers fl  ON fl.person_id = g.person_id
  -- Biggest film by views.
  LEFT JOIN LATERAL (
    SELECT w.id AS film_id, w.view_count
    FROM _ac a JOIN _win w ON w.id = a.film_id
    WHERE a.person_id = g.person_id AND COALESCE(w.view_count, 0) > 0
    ORDER BY w.view_count DESC, w.id
    LIMIT 1
  ) tf ON TRUE
  -- Biggest play by box office, else any.
  LEFT JOIN LATERAL (
    SELECT s.play_id
    FROM _sp s WHERE s.person_id = g.person_id
    ORDER BY s.box_office_domestic DESC NULLS LAST, s.play_id
    LIMIT 1
  ) tp ON TRUE
  -- Most frequent co-star across their 2026 films.
  LEFT JOIN LATERAL (
    SELECT o.person_id AS costar_id, COUNT(*)::INTEGER AS n
    FROM _ac a
    JOIN _ac o ON o.film_id = a.film_id AND o.person_id <> a.person_id
    WHERE a.person_id = g.person_id
    GROUP BY o.person_id
    HAVING COUNT(*) >= 2
    ORDER BY COUNT(*) DESC, o.person_id
    LIMIT 1
  ) tc ON TRUE
  -- Most frequent director across their 2026 films.
  LEFT JOIN LATERAL (
    SELECT d.person_id AS director_id, COUNT(DISTINCT d.film_id)::INTEGER AS n
    FROM _ac a
    JOIN public.credits d ON d.film_id = a.film_id AND d.role = 'director'
    WHERE a.person_id = g.person_id
    GROUP BY d.person_id
    ORDER BY COUNT(DISTINCT d.film_id) DESC, d.person_id
    LIMIT 1
  ) td ON TRUE
  -- Up to 14 posters, best-performing first, films then plays.
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(url ORDER BY ord, sort_views DESC NULLS LAST) AS urls
    FROM (
      SELECT w.poster_url AS url, 0 AS ord, w.view_count AS sort_views
      FROM _ac a JOIN _win w ON w.id = a.film_id
      WHERE a.person_id = g.person_id AND w.poster_url IS NOT NULL
      UNION ALL
      SELECT s.poster_url, 1, NULL::INTEGER
      FROM _sp s
      WHERE s.person_id = g.person_id AND s.poster_url IS NOT NULL
      ORDER BY 2, 3 DESC NULLS LAST
      LIMIT k_max_posters
    ) q
  ) posters ON TRUE;
  CREATE UNIQUE INDEX ON _row (person_id);

  -- Archetype, first match wins. Every line carries a real number from the row.
  CREATE TEMP TABLE _final ON COMMIT DROP AS
  SELECT r.*,
    CASE
      WHEN r.first_year IS NULL OR r.first_year >= 2026          THEN 'The Breakout'
      WHEN r.credits_count >= v_workhorse_min                    THEN 'The Workhorse'
      WHEN r.lead_known_count > 0
       AND r.lead_count::NUMERIC / r.films_count >= k_lead_ratio THEN 'The Lead'
      WHEN COALESCE(r.top_director_films, 0) >= k_loyalist_min   THEN 'The Loyalist'
      WHEN r.lead_known_count > 0
       AND r.lead_count::NUMERIC / r.films_count < k_stealer_lead_max
       AND r.total_views::NUMERIC / r.films_count > v_median_vpf THEN 'The Scene Stealer'
      ELSE 'The Ensemble Player'
    END AS archetype
  FROM _row r;

  CREATE TEMP TABLE _out ON COMMIT DROP AS
  SELECT f.*,
    CASE f.archetype
      WHEN 'The Breakout' THEN
        'Your first year on the record, and you put ' || f.films_count || ' films on it.'
      WHEN 'The Workhorse' THEN
        'More films released this year than ' || COALESCE(f.percentile, 90)::INTEGER || '% of actors on MuviDB.'
      WHEN 'The Lead' THEN
        'Top billing on ' || f.lead_count || ' of your ' || f.films_count || ' films this year.'
      WHEN 'The Loyalist' THEN
        f.top_director_films || ' films with the same director this year. That is a partnership.'
      WHEN 'The Scene Stealer' THEN
        'No top billing needed — ' || public.rewind_fmt_views(f.total_views) || ' views across your 2026 films.'
      ELSE
        f.films_count || ' films and ' || f.hours_on_screen || ' hours on screen in one year.'
    END AS archetype_line,
    MD5(CONCAT_WS('|',
      f.display_name, f.portrait_url, f.films_count, f.plays_count,
      f.lead_count, f.support_count, f.lead_known_count, f.total_views,
      f.hours_on_screen, f.top_film_id, f.top_film_views, f.top_play_id,
      f.box_office_total, f.box_office_currency, f.top_costar_id, f.top_costar_films,
      f.top_director_id, f.top_director_films, f.followers, f.percentile,
      f.archetype, ARRAY_TO_STRING(f.poster_urls, ','), f.eligible
    )) AS stats_hash
  FROM _final f;

  -- Anyone who fell out of the window since the last run stops being public.
  UPDATE public.rewind_2026 t
     SET eligible = FALSE, snapshot_at = NOW()
   WHERE t.eligible
     AND NOT EXISTS (SELECT 1 FROM _out o WHERE o.person_id = t.person_id AND o.eligible);

  WITH upserted AS (
    INSERT INTO public.rewind_2026 AS t (
      person_id, slug, display_name, portrait_url,
      films_count, plays_count, lead_count, support_count, lead_known_count,
      total_views, hours_on_screen,
      top_film_id, top_film_views, top_play_id,
      box_office_total, box_office_currency,
      top_costar_id, top_costar_films, top_director_id, top_director_films,
      followers, percentile, archetype, archetype_line, poster_urls,
      eligible, stats_hash, snapshot_at
    )
    SELECT o.person_id, o.slug, o.display_name, o.portrait_url,
           o.films_count, o.plays_count, o.lead_count, o.support_count, o.lead_known_count,
           o.total_views, o.hours_on_screen,
           o.top_film_id, o.top_film_views, o.top_play_id,
           o.box_office_total, o.box_office_currency,
           o.top_costar_id, o.top_costar_films, o.top_director_id, o.top_director_films,
           o.followers, o.percentile, o.archetype, o.archetype_line,
           COALESCE(o.poster_urls, '{}'::TEXT[]),
           o.eligible, o.stats_hash, NOW()
    FROM _out o
    WHERE o.slug IS NOT NULL
    ON CONFLICT (person_id) DO UPDATE SET
      slug = EXCLUDED.slug,
      display_name = EXCLUDED.display_name,
      portrait_url = EXCLUDED.portrait_url,
      films_count = EXCLUDED.films_count,
      plays_count = EXCLUDED.plays_count,
      lead_count = EXCLUDED.lead_count,
      support_count = EXCLUDED.support_count,
      lead_known_count = EXCLUDED.lead_known_count,
      total_views = EXCLUDED.total_views,
      hours_on_screen = EXCLUDED.hours_on_screen,
      top_film_id = EXCLUDED.top_film_id,
      top_film_views = EXCLUDED.top_film_views,
      top_play_id = EXCLUDED.top_play_id,
      box_office_total = EXCLUDED.box_office_total,
      box_office_currency = EXCLUDED.box_office_currency,
      top_costar_id = EXCLUDED.top_costar_id,
      top_costar_films = EXCLUDED.top_costar_films,
      top_director_id = EXCLUDED.top_director_id,
      top_director_films = EXCLUDED.top_director_films,
      followers = EXCLUDED.followers,
      percentile = EXCLUDED.percentile,
      archetype = EXCLUDED.archetype,
      archetype_line = EXCLUDED.archetype_line,
      poster_urls = EXCLUDED.poster_urls,
      eligible = EXCLUDED.eligible,
      stats_hash = EXCLUDED.stats_hash,
      snapshot_at = NOW(),
      -- Renders survive a re-run unless the numbers behind them moved.
      video_url     = CASE WHEN t.stats_hash IS DISTINCT FROM EXCLUDED.stats_hash THEN NULL ELSE t.video_url END,
      story_png_url = CASE WHEN t.stats_hash IS DISTINCT FROM EXCLUDED.stats_hash THEN NULL ELSE t.story_png_url END,
      feed_png_url  = CASE WHEN t.stats_hash IS DISTINCT FROM EXCLUDED.stats_hash THEN NULL ELSE t.feed_png_url END,
      rendered_at   = CASE WHEN t.stats_hash IS DISTINCT FROM EXCLUDED.stats_hash THEN NULL ELSE t.rendered_at END
    RETURNING t.eligible, (t.video_url IS NULL AND t.rendered_at IS NULL) AS needs_render
  )
  SELECT COUNT(*)::INTEGER,
         COUNT(*) FILTER (WHERE eligible)::INTEGER,
         COUNT(*) FILTER (WHERE needs_render)::INTEGER
    INTO v_total, v_eligible, v_needs_render
  FROM upserted;

  RETURN QUERY SELECT v_total, v_eligible, v_needs_render;
END;
$$;

REVOKE ALL ON FUNCTION public.build_rewind_2026(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_rewind_2026(DATE) TO service_role;
GRANT EXECUTE ON FUNCTION public.rewind_fmt_views(BIGINT) TO anon, authenticated, service_role;


-- Rollback:
--   DROP FUNCTION IF EXISTS public.build_rewind_2026(DATE);
--   DROP FUNCTION IF EXISTS public.rewind_fmt_views(BIGINT);
--   DROP TABLE IF EXISTS public.rewind_events;
--   DROP TABLE IF EXISTS public.rewind_2026;
