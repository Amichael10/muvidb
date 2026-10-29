-- =============================================================================
-- 20261029000005_fix_all_unique_constraints.sql
-- Nullifies all unique columns (imdb_id, source_video_id, tmdb_id, mubi_id, mubi_slug)
-- on secondary film before updating primary film to avoid unique constraint violations.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.merge_films(
  p_primary_id uuid,
  p_secondary_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary public.films%ROWTYPE;
  v_secondary public.films%ROWTYPE;
  v_tmdb_id integer;
  v_mubi_id integer;
BEGIN
  IF p_primary_id IS NULL OR p_secondary_id IS NULL OR p_primary_id = p_secondary_id THEN
    RAISE EXCEPTION 'Primary and secondary films must be different records';
  END IF;

  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_primary FROM public.films WHERE id = p_primary_id FOR UPDATE;
  SELECT * INTO v_secondary FROM public.films WHERE id = p_secondary_id FOR UPDATE;
  IF v_primary.id IS NULL OR v_secondary.id IS NULL THEN
    RAISE EXCEPTION 'One or more film records no longer exist';
  END IF;

  IF v_primary.tmdb_id IS NOT NULL
     AND v_secondary.tmdb_id IS NOT NULL
     AND v_primary.tmdb_id <> v_secondary.tmdb_id
     AND NOT (p_metadata ? 'tmdb_id') THEN
    RAISE EXCEPTION 'Merge blocked: select which TMDB ID to retain';
  END IF;

  v_tmdb_id := CASE WHEN p_metadata ? 'tmdb_id'
    THEN NULLIF(p_metadata->>'tmdb_id', '')::integer
    ELSE COALESCE(v_primary.tmdb_id, v_secondary.tmdb_id) END;
  v_mubi_id := CASE WHEN p_metadata ? 'mubi_id'
    THEN NULLIF(p_metadata->>'mubi_id', '')::integer
    ELSE COALESCE(v_primary.mubi_id, v_secondary.mubi_id) END;

  -- 1. Transfer Critic Reviews (deduplicating by review_url or critic_id)
  DELETE FROM public.critic_reviews secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.critic_reviews primary_row
      WHERE primary_row.film_id = p_primary_id
        AND (
          (secondary_row.review_url IS NOT NULL AND primary_row.review_url = secondary_row.review_url)
          OR (secondary_row.critic_id IS NOT NULL AND primary_row.critic_id = secondary_row.critic_id)
        )
    );
  UPDATE public.critic_reviews SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  -- 2. Transfer Film Media (deduplicating by url)
  DELETE FROM public.film_media secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_media primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.url = secondary_row.url
    );
  UPDATE public.film_media SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  -- 3. Relational tables
  UPDATE public.channel_videos SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.collection_films secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.collection_films primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.collection_id = secondary_row.collection_id
    );
  UPDATE public.collection_films SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.credits secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.credits primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.person_id = secondary_row.person_id
        AND primary_row.role = secondary_row.role
    );
  UPDATE public.credits SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.credit_candidates secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.credit_candidates primary_row
      WHERE primary_row.film_id = p_primary_id
        AND lower(trim(primary_row.raw_name)) = lower(trim(secondary_row.raw_name))
    );
  UPDATE public.credit_candidates SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.credit_harvest_jobs WHERE film_id = p_secondary_id;

  UPDATE public.actor_credit_requests SET film_id = p_primary_id WHERE film_id = p_secondary_id;
  UPDATE public.actor_credit_requests SET applied_film_id = p_primary_id WHERE applied_film_id = p_secondary_id;

  DELETE FROM public.film_companies secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_companies primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.company_id = secondary_row.company_id
        AND primary_row.role = secondary_row.role
    );
  UPDATE public.film_companies SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_countries secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_countries primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.country_id = secondary_row.country_id
    );
  UPDATE public.film_countries SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_genres secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_genres primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.genre_id = secondary_row.genre_id
    );
  UPDATE public.film_genres SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_reactions secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_reactions primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.user_id IS NOT DISTINCT FROM secondary_row.user_id
        AND primary_row.reaction_type IS NOT DISTINCT FROM secondary_row.reaction_type
    );
  UPDATE public.film_reactions SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_watch_links secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_watch_links primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.url = secondary_row.url
    );
  UPDATE public.film_watch_links SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  UPDATE public.pending_cinema_films SET promoted_film_id = p_primary_id WHERE promoted_film_id = p_secondary_id;

  DELETE FROM public.platform_new_releases secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.platform_new_releases primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.platform = secondary_row.platform
    );
  UPDATE public.platform_new_releases SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.reviews secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.reviews primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.source = secondary_row.source
        AND (
          (secondary_row.external_id IS NOT NULL AND primary_row.external_id = secondary_row.external_id)
          OR (secondary_row.user_id IS NOT NULL AND primary_row.user_id = secondary_row.user_id)
        )
    );
  UPDATE public.reviews SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.showtimes secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.showtimes primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.cinema_id = secondary_row.cinema_id
        AND primary_row.show_date = secondary_row.show_date
        AND primary_row.show_time = secondary_row.show_time
        AND primary_row.format = secondary_row.format
    );
  UPDATE public.showtimes SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  IF EXISTS (SELECT 1 FROM public.top_10_films WHERE film_id = p_primary_id) THEN
    DELETE FROM public.top_10_films WHERE film_id = p_secondary_id;
  ELSE
    UPDATE public.top_10_films SET film_id = p_primary_id WHERE film_id = p_secondary_id;
  END IF;

  DELETE FROM public.trailer_review_queue secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.trailer_review_queue primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.youtube_video_id = secondary_row.youtube_video_id
    );
  UPDATE public.trailer_review_queue SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.watchlist secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.watchlist primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.user_id = secondary_row.user_id
    );
  UPDATE public.watchlist SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.youtube_stats secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.youtube_stats primary_row
      WHERE primary_row.film_id = p_primary_id
        AND primary_row.youtube_video_id = secondary_row.youtube_video_id
    );
  UPDATE public.youtube_stats SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_related WHERE film_id = p_secondary_id OR related_id = p_secondary_id;

  UPDATE public.films
  SET series_id = p_primary_id
  WHERE series_id = p_secondary_id
    AND id NOT IN (p_primary_id, p_secondary_id);
  UPDATE public.films
  SET series_id = NULL
  WHERE id = p_primary_id
    AND series_id = p_secondary_id;

  -- Free unique constraints on secondary before updating primary
  UPDATE public.films SET tmdb_id = NULL WHERE id = p_secondary_id;
  UPDATE public.films SET mubi_id = NULL WHERE id = p_secondary_id;
  UPDATE public.films SET mubi_slug = NULL WHERE id = p_secondary_id;
  UPDATE public.films SET source_video_id = NULL WHERE id = p_secondary_id;
  UPDATE public.films SET imdb_id = NULL WHERE id = p_secondary_id;

  -- 4. Update the Primary Surviving Film with Preserved Metrics and Metadata
  UPDATE public.films
  SET
    title = COALESCE(NULLIF(p_metadata->>'title', ''), v_primary.title, v_secondary.title),
    original_title = COALESCE(NULLIF(p_metadata->>'original_title', ''), v_primary.original_title, v_secondary.original_title),
    synopsis = COALESCE(NULLIF(p_metadata->>'synopsis', ''), v_primary.synopsis, v_secondary.synopsis),
    tagline = COALESCE(NULLIF(p_metadata->>'tagline', ''), v_primary.tagline, v_secondary.tagline),
    poster_url = COALESCE(NULLIF(p_metadata->>'poster_url', ''), v_primary.poster_url, v_secondary.poster_url),
    backdrop_url = COALESCE(NULLIF(p_metadata->>'backdrop_url', ''), v_primary.backdrop_url, v_secondary.backdrop_url),
    backdrop = COALESCE(v_primary.backdrop, v_secondary.backdrop),
    year = CASE
      WHEN p_metadata ? 'year' AND NULLIF(p_metadata->>'year', '') IS NOT NULL THEN (p_metadata->>'year')::integer
      ELSE COALESCE(v_primary.year, v_secondary.year)
    END,
    release_date = CASE
      WHEN p_metadata ? 'release_date' AND NULLIF(p_metadata->>'release_date', '') IS NOT NULL THEN (p_metadata->>'release_date')::date
      ELSE COALESCE(v_primary.release_date, v_secondary.release_date)
    END,
    runtime_minutes = CASE
      WHEN p_metadata ? 'runtime_minutes' AND NULLIF(p_metadata->>'runtime_minutes', '') IS NOT NULL THEN (p_metadata->>'runtime_minutes')::integer
      ELSE COALESCE(v_primary.runtime_minutes, v_secondary.runtime_minutes)
    END,
    duration = COALESCE(v_primary.duration, v_secondary.duration),
    language = COALESCE(NULLIF(p_metadata->>'language', ''), v_primary.language, v_secondary.language),
    languages = COALESCE(v_primary.languages, v_secondary.languages),
    countries = COALESCE(v_primary.countries, v_secondary.countries),
    genres = COALESCE(v_primary.genres, v_secondary.genres),
    tmdb_id = v_tmdb_id,
    mubi_id = v_mubi_id,
    mubi_slug = COALESCE(v_primary.mubi_slug, v_secondary.mubi_slug),
    source = COALESCE(v_primary.source, v_secondary.source),
    source_video_id = COALESCE(NULLIF(p_metadata->>'source_video_id', ''), v_primary.source_video_id, v_secondary.source_video_id),
    youtube_watch_url = COALESCE(NULLIF(p_metadata->>'youtube_watch_url', ''), v_primary.youtube_watch_url, v_secondary.youtube_watch_url),
    trailer_youtube_id = COALESCE(NULLIF(p_metadata->>'trailer_youtube_id', ''), v_primary.trailer_youtube_id, v_secondary.trailer_youtube_id),
    trailer_external_url = COALESCE(NULLIF(p_metadata->>'trailer_external_url', ''), v_primary.trailer_external_url, v_secondary.trailer_external_url),
    trailer_source = COALESCE(NULLIF(p_metadata->>'trailer_source', ''), v_primary.trailer_source, v_secondary.trailer_source),
    release_type = COALESCE(NULLIF(p_metadata->>'release_type', ''), v_primary.release_type, v_secondary.release_type),
    content_type = COALESCE(NULLIF(p_metadata->>'content_type', ''), v_primary.content_type, v_secondary.content_type),
    status = CASE
      WHEN p_metadata ? 'status' AND NULLIF(p_metadata->>'status', '') IS NOT NULL THEN (p_metadata->>'status')::public.film_status
      ELSE COALESCE(v_primary.status, v_secondary.status)
    END,
    nfvcb_rating = COALESCE(v_primary.nfvcb_rating, v_secondary.nfvcb_rating),
    streaming_links = CASE
      WHEN v_primary.streaming_links IS NOT NULL AND v_secondary.streaming_links IS NOT NULL
        THEN v_secondary.streaming_links || v_primary.streaming_links
      ELSE COALESCE(v_primary.streaming_links, v_secondary.streaming_links)
    END,
    awards = COALESCE(v_primary.awards, '[]'::jsonb) || COALESCE(v_secondary.awards, '[]'::jsonb),
    is_published = COALESCE(v_primary.is_published, false) OR COALESCE(v_secondary.is_published, false),
    is_featured = COALESCE(v_primary.is_featured, false) OR COALESCE(v_secondary.is_featured, false),
    is_in_cinemas = COALESCE(v_primary.is_in_cinemas, false) OR COALESCE(v_secondary.is_in_cinemas, false),
    is_nollywood = COALESCE(v_primary.is_nollywood, false) OR COALESCE(v_secondary.is_nollywood, false),
    is_top_10 = COALESCE(v_primary.is_top_10, false) OR COALESCE(v_secondary.is_top_10, false),
    is_trending = COALESCE(v_primary.is_trending, false) OR COALESCE(v_secondary.is_trending, false),
    coming_soon = COALESCE(v_primary.coming_soon, false) OR COALESCE(v_secondary.coming_soon, false),
    needs_review = COALESCE(v_primary.needs_review, false) OR COALESCE(v_secondary.needs_review, false),
    view_count = CASE
      WHEN p_metadata ? 'view_count' AND NULLIF(p_metadata->>'view_count', '') IS NOT NULL
        THEN (p_metadata->>'view_count')::bigint
      WHEN v_primary.view_count IS NOT NULL AND v_secondary.view_count IS NOT NULL
        THEN GREATEST(v_primary.view_count, v_secondary.view_count)
      ELSE COALESCE(v_primary.view_count, v_secondary.view_count, 0)
    END,
    audience_rating_count = COALESCE(v_primary.audience_rating_count, 0) + COALESCE(v_secondary.audience_rating_count, 0),
    average_rating = GREATEST(COALESCE(v_primary.average_rating, 0), COALESCE(v_secondary.average_rating, 0)),
    audience_rating = COALESCE(v_primary.audience_rating, v_secondary.audience_rating),
    liked_percent = COALESCE(v_primary.liked_percent, v_secondary.liked_percent),
    tmdb_rating = COALESCE(v_primary.tmdb_rating, v_secondary.tmdb_rating),
    tmdb_vote_count = GREATEST(COALESCE(v_primary.tmdb_vote_count, 0), COALESCE(v_secondary.tmdb_vote_count, 0)),
    imdb_id = COALESCE(NULLIF(p_metadata->>'imdb_id', ''), v_primary.imdb_id, v_secondary.imdb_id),
    imdb_rating = COALESCE(v_primary.imdb_rating, v_secondary.imdb_rating),
    imdb_vote_count = GREATEST(COALESCE(v_primary.imdb_vote_count, 0), COALESCE(v_secondary.imdb_vote_count, 0)),
    budget = COALESCE(v_primary.budget, v_secondary.budget),
    distributor = COALESCE(NULLIF(p_metadata->>'distributor', ''), v_primary.distributor, v_secondary.distributor),
    box_office_domestic = CASE
      WHEN p_metadata ? 'box_office_domestic' AND NULLIF(p_metadata->>'box_office_domestic', '') IS NOT NULL
        THEN (p_metadata->>'box_office_domestic')::numeric
      WHEN v_primary.box_office_domestic IS NOT NULL AND v_secondary.box_office_domestic IS NOT NULL
        THEN GREATEST(v_primary.box_office_domestic, v_secondary.box_office_domestic)
      ELSE COALESCE(v_primary.box_office_domestic, v_secondary.box_office_domestic)
    END,
    box_office_worldwide = CASE
      WHEN p_metadata ? 'box_office_worldwide' AND NULLIF(p_metadata->>'box_office_worldwide', '') IS NOT NULL
        THEN (p_metadata->>'box_office_worldwide')::numeric
      WHEN v_primary.box_office_worldwide IS NOT NULL AND v_secondary.box_office_worldwide IS NOT NULL
        THEN GREATEST(v_primary.box_office_worldwide, v_secondary.box_office_worldwide)
      ELSE COALESCE(v_primary.box_office_worldwide, v_secondary.box_office_worldwide)
    END,
    box_office_opening_weekend = CASE
      WHEN p_metadata ? 'box_office_opening_weekend' AND NULLIF(p_metadata->>'box_office_opening_weekend', '') IS NOT NULL
        THEN (p_metadata->>'box_office_opening_weekend')::numeric
      WHEN v_primary.box_office_opening_weekend IS NOT NULL AND v_secondary.box_office_opening_weekend IS NOT NULL
        THEN GREATEST(v_primary.box_office_opening_weekend, v_secondary.box_office_opening_weekend)
      ELSE COALESCE(v_primary.box_office_opening_weekend, v_secondary.box_office_opening_weekend)
    END,
    box_office_currency = COALESCE(NULLIF(p_metadata->>'box_office_currency', ''), v_primary.box_office_currency, v_secondary.box_office_currency, 'NGN'),
    box_office_source = COALESCE(NULLIF(p_metadata->>'box_office_source', ''), v_primary.box_office_source, v_secondary.box_office_source),
    box_office_updated_at = GREATEST(v_primary.box_office_updated_at, v_secondary.box_office_updated_at),
    updated_at = now()
  WHERE id = p_primary_id;

  DELETE FROM public.films WHERE id = p_secondary_id;
END;
$$;
