-- Migration: 20261112165230_rewind_2026_archetype_copy.sql
-- Description: Two fixes to what build_rewind_2026() writes, found by reading
--              the generated rows.
--
-- 1. "More films released this year than 100% of actors on MuviDB." No actor
--    out-credits 100% of actors -- PERCENT_RANK gives exactly 1.0 to whoever
--    tops the list, and 156 Workhorses were about to say so on camera. The
--    spoken number is now capped at 99. The stored percentile keeps its true
--    value; only the line is clamped.
--
-- 2. A NULL first_year was treated as a 2026 debut. It is not evidence of a
--    debut, it is an absence of evidence -- a film with neither release_date
--    nor year. Those actors now fall through to the later rules instead of
--    being handed "The Breakout".
--
-- Nothing else changes; the rest of the function is byte-identical to
-- 20261112164330.

CREATE OR REPLACE FUNCTION public.build_rewind_2026(p_cutoff DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (rows_total INTEGER, rows_eligible INTEGER, rows_needing_render INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
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
  DROP TABLE IF EXISTS _cinema, _win, _ac, _sp, _agg, _coh, _cf,
                       _costar, _dir, _topfilm, _topplay, _posters,
                       _row, _final, _out;

  -- Films that actually played a cinema screen in 2026. Resolved once: as a
  -- correlated EXISTS it re-ran per candidate film and dominated the runtime.
  CREATE TEMP TABLE _cinema ON COMMIT DROP AS
  SELECT DISTINCT s.film_id
  FROM public.showtimes s
  WHERE s.show_date >= k_year_start AND s.show_date <= p_cutoff;
  CREATE UNIQUE INDEX ON _cinema (film_id);
  ANALYZE _cinema;

  -- The 2026 window. Three ways in, because we do not store a Nigerian cinema
  -- release date: a dated 2026 release; an undated film stamped year = 2026;
  -- or anything in _cinema above.
  CREATE TEMP TABLE _win ON COMMIT DROP AS
  SELECT f.id,
         NULLIF(REGEXP_REPLACE(f.poster_url, '\s', '', 'g'), '') AS poster_url,
         f.view_count, f.runtime_minutes,
         f.box_office_domestic, f.box_office_worldwide, f.box_office_currency
  FROM public.films f
  WHERE f.is_published
    AND (
         (f.release_date IS NOT NULL AND f.release_date >= k_year_start AND f.release_date <= p_cutoff)
      OR (f.release_date IS NULL AND f.year = 2026)
      OR f.id IN (SELECT film_id FROM _cinema)
    );
  CREATE UNIQUE INDEX ON _win (id);
  ANALYZE _win;

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
  ANALYZE _ac;

  -- 2026 stage work, but only for people who also have a 2026 film credit.
  CREATE TEMP TABLE _sp ON COMMIT DROP AS
  SELECT DISTINCT sc.person_id, sc.play_id,
         NULLIF(REGEXP_REPLACE(p.poster_url, '\s', '', 'g'), '') AS poster_url,
         p.box_office_domestic, p.box_office_currency
  FROM public.stage_credits sc
  JOIN public.plays p ON p.id = sc.play_id
  WHERE p.year = 2026
    AND sc.role ~* '(actor|actress|cast)'
    AND (p.run_start_date IS NULL OR p.run_start_date <= p_cutoff)
    AND EXISTS (SELECT 1 FROM _ac a WHERE a.person_id = sc.person_id);
  CREATE INDEX ON _sp (person_id);
  ANALYZE _sp;

  -- Per-person aggregate over both. Covers EVERY actor with a 2026 credit,
  -- because the percentile claim in the video is about that whole population.
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
         COALESCE(f.film_currency, st.play_currency)          AS box_office_currency,
         ROUND((PERCENT_RANK() OVER (ORDER BY f.films_count + COALESCE(st.plays_count, 0)))::NUMERIC * 100, 0) AS percentile
  FROM film_side f
  LEFT JOIN stage_side st ON st.person_id = f.person_id;
  CREATE UNIQUE INDEX ON _agg (person_id);
  ANALYZE _agg;

  -- Everything below this line only concerns actors who clear the credit bar.
  CREATE TEMP TABLE _coh ON COMMIT DROP AS
  SELECT person_id FROM _agg WHERE credits_count >= k_min_credits;
  CREATE UNIQUE INDEX ON _coh (person_id);

  CREATE TEMP TABLE _cf ON COMMIT DROP AS
  SELECT a.person_id, a.film_id FROM _ac a JOIN _coh c ON c.person_id = a.person_id;
  CREATE INDEX ON _cf (person_id);
  CREATE INDEX ON _cf (film_id);
  ANALYZE _cf;

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

  -- Biggest film by views. Tiebroken on id so it cannot flip between builds.
  CREATE TEMP TABLE _topfilm ON COMMIT DROP AS
  SELECT DISTINCT ON (cf.person_id) cf.person_id, w.id AS film_id, w.view_count
  FROM _cf cf JOIN _win w ON w.id = cf.film_id
  WHERE COALESCE(w.view_count, 0) > 0
  ORDER BY cf.person_id, w.view_count DESC, w.id;
  CREATE UNIQUE INDEX ON _topfilm (person_id);

  -- Biggest play by box office, else any. Tiebroken on id.
  CREATE TEMP TABLE _topplay ON COMMIT DROP AS
  SELECT DISTINCT ON (s.person_id) s.person_id, s.play_id
  FROM _sp s JOIN _coh c ON c.person_id = s.person_id
  ORDER BY s.person_id, s.box_office_domestic DESC NULLS LAST, s.play_id;
  CREATE UNIQUE INDEX ON _topplay (person_id);

  -- Most frequent co-star, one pass over the cohort's films. Tiebroken on id.
  CREATE TEMP TABLE _costar ON COMMIT DROP AS
  SELECT DISTINCT ON (t.person_id) t.person_id, t.costar_id, t.n
  FROM (
    SELECT cf.person_id, o.person_id AS costar_id, COUNT(*)::INTEGER AS n
    FROM _cf cf
    JOIN _ac o ON o.film_id = cf.film_id AND o.person_id <> cf.person_id
    GROUP BY cf.person_id, o.person_id
    HAVING COUNT(*) >= 2
  ) t
  ORDER BY t.person_id, t.n DESC, t.costar_id;
  CREATE UNIQUE INDEX ON _costar (person_id);

  -- Most frequent director, one pass. Tiebroken on id.
  CREATE TEMP TABLE _dir ON COMMIT DROP AS
  SELECT DISTINCT ON (t.person_id) t.person_id, t.director_id, t.n
  FROM (
    SELECT cf.person_id, d.person_id AS director_id, COUNT(DISTINCT d.film_id)::INTEGER AS n
    FROM _cf cf
    JOIN public.credits d ON d.film_id = cf.film_id AND d.role = 'director'
    GROUP BY cf.person_id, d.person_id
  ) t
  ORDER BY t.person_id, t.n DESC, t.director_id;
  CREATE UNIQUE INDEX ON _dir (person_id);

  -- Up to k_max_posters, best-performing films first, then plays. The url is
  -- the final tiebreaker: without it, films on equal view counts came back in
  -- a different order on every build and churned the array.
  CREATE TEMP TABLE _posters ON COMMIT DROP AS
  SELECT r.person_id, ARRAY_AGG(r.url ORDER BY r.rn) AS urls
  FROM (
    SELECT u.person_id, u.url,
           ROW_NUMBER() OVER (PARTITION BY u.person_id
                              ORDER BY u.ord, u.sort_views DESC NULLS LAST, u.url) AS rn
    FROM (
      SELECT cf.person_id, w.poster_url AS url, 0 AS ord, w.view_count AS sort_views
      FROM _cf cf JOIN _win w ON w.id = cf.film_id
      WHERE w.poster_url IS NOT NULL
      UNION
      SELECT s.person_id, s.poster_url, 1, NULL::INTEGER
      FROM _sp s JOIN _coh c ON c.person_id = s.person_id
      WHERE s.poster_url IS NOT NULL
    ) u
  ) r
  WHERE r.rn <= k_max_posters
  GROUP BY r.person_id;
  CREATE UNIQUE INDEX ON _posters (person_id);

  CREATE TEMP TABLE _row ON COMMIT DROP AS
  WITH first_credit AS (
    -- Earliest release year anywhere in their filmography, for The Breakout.
    SELECT c.person_id,
           MIN(COALESCE(EXTRACT(YEAR FROM f.release_date)::INTEGER, f.year)) AS first_year
    FROM public.credits c
    JOIN _coh co ON co.person_id = c.person_id
    JOIN public.films f ON f.id = c.film_id
    WHERE c.role = 'actor'
    GROUP BY c.person_id
  ),
  followers AS (
    SELECT fo.person_id, COUNT(*)::INTEGER AS followers
    FROM public.follows fo
    JOIN _coh co ON co.person_id = fo.person_id
    GROUP BY fo.person_id
  )
  SELECT
    g.person_id,
    p.slug,
    p.name                                     AS display_name,
    NULLIF(REGEXP_REPLACE(p.photo_url, '\s', '', 'g'), '') AS portrait_url,
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
    g.percentile,
    fc.first_year,
    po.urls                                    AS poster_urls,
    (p.slug IS NOT NULL
      AND NULLIF(REGEXP_REPLACE(p.photo_url, '\s', '', 'g'), '') IS NOT NULL
      AND g.posters_count::NUMERIC / g.credits_count >= k_min_poster_ratio) AS eligible
  FROM _agg g
  JOIN _coh co            ON co.person_id = g.person_id
  JOIN public.people p    ON p.id = g.person_id
  LEFT JOIN first_credit fc ON fc.person_id = g.person_id
  LEFT JOIN followers fl  ON fl.person_id = g.person_id
  LEFT JOIN _topfilm tf   ON tf.person_id = g.person_id
  LEFT JOIN _topplay tp   ON tp.person_id = g.person_id
  LEFT JOIN _costar tc    ON tc.person_id = g.person_id
  LEFT JOIN _dir td       ON td.person_id = g.person_id
  LEFT JOIN _posters po   ON po.person_id = g.person_id;
  CREATE UNIQUE INDEX ON _row (person_id);

  -- Archetype, first match wins. Every line carries a real number from the row.
  CREATE TEMP TABLE _final ON COMMIT DROP AS
  SELECT r.*,
    CASE
      WHEN r.first_year IS NOT NULL AND r.first_year >= 2026     THEN 'The Breakout'
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
        'More films released this year than ' || LEAST(COALESCE(f.percentile, 90), 99)::INTEGER || '% of actors on MuviDB.'
      WHEN 'The Lead' THEN
        'Top billing on ' || f.lead_count || ' of your ' || f.films_count || ' films this year.'
      WHEN 'The Loyalist' THEN
        f.top_director_films || ' films with the same director this year. That is a partnership.'
      WHEN 'The Scene Stealer' THEN
        'No top billing needed. ' || public.rewind_fmt_views(f.total_views) || ' views across your 2026 films.'
      ELSE
        f.films_count || ' films and ' || f.hours_on_screen || ' hours on screen in one year.'
    END AS archetype_line,
    -- Hash the values AS DISPLAYED, not the raw ones. The YouTube sync nudges
    -- total_views every few hours; hashing the raw number would discard a
    -- correct render because 8,933,086 became 8,970,979 and both read "8.9M".
    MD5(CONCAT_WS('|',
      f.display_name, f.portrait_url, f.films_count, f.plays_count,
      f.lead_count, f.support_count, f.lead_known_count,
      public.rewind_fmt_views(f.total_views),
      f.hours_on_screen, f.top_film_id,
      public.rewind_fmt_views(f.top_film_views),
      f.top_play_id,
      ROUND(f.box_office_total), f.box_office_currency,
      f.top_costar_id, f.top_costar_films,
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
$fn$;

REVOKE ALL ON FUNCTION public.build_rewind_2026(DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.build_rewind_2026(DATE) TO service_role;
