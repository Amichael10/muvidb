-- Full-catalog duplicate review and transactional group merges.

CREATE TABLE IF NOT EXISTS public.dedupe_ignored_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('people', 'films')),
  left_record_id uuid NOT NULL,
  right_record_id uuid NOT NULL,
  reason text,
  ignored_by uuid REFERENCES public.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dedupe_ignored_pairs_ordered CHECK (left_record_id::text < right_record_id::text),
  CONSTRAINT dedupe_ignored_pairs_unique UNIQUE (entity_type, left_record_id, right_record_id)
);

CREATE INDEX IF NOT EXISTS dedupe_ignored_pairs_entity_idx
  ON public.dedupe_ignored_pairs(entity_type);

CREATE TABLE IF NOT EXISTS public.dedupe_scan_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('people', 'films')),
  records_scanned integer NOT NULL DEFAULT 0,
  candidate_groups integer NOT NULL DEFAULT 0,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS dedupe_scan_runs_entity_created_idx
  ON public.dedupe_scan_runs(entity_type, started_at DESC);

ALTER TABLE public.dedupe_ignored_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dedupe_scan_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage dedupe ignored pairs" ON public.dedupe_ignored_pairs;
CREATE POLICY "Admins manage dedupe ignored pairs"
  ON public.dedupe_ignored_pairs
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ));

DROP POLICY IF EXISTS "Admins read dedupe scan runs" ON public.dedupe_scan_runs;
CREATE POLICY "Admins read dedupe scan runs"
  ON public.dedupe_scan_runs
  FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dedupe_ignored_pairs TO authenticated;
GRANT SELECT ON public.dedupe_scan_runs TO authenticated;
GRANT ALL ON public.dedupe_ignored_pairs, public.dedupe_scan_runs TO service_role;

CREATE OR REPLACE FUNCTION public.merge_people(
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
  v_primary public.people%ROWTYPE;
  v_secondary public.people%ROWTYPE;
  v_tmdb_id integer;
  v_mubi_id integer;
  v_linked_users integer;
  v_claim_users integer;
BEGIN
  IF p_primary_id IS NULL OR p_secondary_id IS NULL OR p_primary_id = p_secondary_id THEN
    RAISE EXCEPTION 'Primary and secondary people must be different records';
  END IF;

  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_primary FROM public.people WHERE id = p_primary_id FOR UPDATE;
  SELECT * INTO v_secondary FROM public.people WHERE id = p_secondary_id FOR UPDATE;
  IF v_primary.id IS NULL OR v_secondary.id IS NULL THEN
    RAISE EXCEPTION 'One or more people records no longer exist';
  END IF;

  IF v_primary.claimed_by IS NOT NULL
     AND v_secondary.claimed_by IS NOT NULL
     AND v_primary.claimed_by <> v_secondary.claimed_by THEN
    RAISE EXCEPTION 'Merge blocked: profiles are claimed by different users';
  END IF;

  SELECT count(DISTINCT id) INTO v_linked_users
  FROM public.users
  WHERE linked_profile_id IN (p_primary_id, p_secondary_id);
  IF v_linked_users > 1 THEN
    RAISE EXCEPTION 'Merge blocked: profiles are linked to different user accounts';
  END IF;

  SELECT count(DISTINCT user_id) INTO v_claim_users
  FROM public.profile_claims
  WHERE person_id IN (p_primary_id, p_secondary_id);
  IF v_claim_users > 1 THEN
    RAISE EXCEPTION 'Merge blocked: profiles have claims from different users';
  END IF;

  IF v_primary.tmdb_id IS NOT NULL
     AND v_secondary.tmdb_id IS NOT NULL
     AND v_primary.tmdb_id <> v_secondary.tmdb_id
     AND NOT (p_metadata ? 'tmdb_id') THEN
    RAISE EXCEPTION 'Merge blocked: select which TMDB ID to retain';
  END IF;
  IF v_primary.mubi_id IS NOT NULL
     AND v_secondary.mubi_id IS NOT NULL
     AND v_primary.mubi_id <> v_secondary.mubi_id
     AND NOT (p_metadata ? 'mubi_id') THEN
    RAISE EXCEPTION 'Merge blocked: select which MUBI ID to retain';
  END IF;

  v_tmdb_id := CASE WHEN p_metadata ? 'tmdb_id'
    THEN NULLIF(p_metadata->>'tmdb_id', '')::integer
    ELSE COALESCE(v_primary.tmdb_id, v_secondary.tmdb_id) END;
  v_mubi_id := CASE WHEN p_metadata ? 'mubi_id'
    THEN NULLIF(p_metadata->>'mubi_id', '')::integer
    ELSE COALESCE(v_primary.mubi_id, v_secondary.mubi_id) END;

  DELETE FROM public.credits secondary_credit
  WHERE secondary_credit.person_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.credits primary_credit
      WHERE primary_credit.person_id = p_primary_id
        AND primary_credit.film_id = secondary_credit.film_id
        AND primary_credit.role = secondary_credit.role
    );
  UPDATE public.credits SET person_id = p_primary_id WHERE person_id = p_secondary_id;

  DELETE FROM public.follows secondary_follow
  WHERE secondary_follow.person_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.follows primary_follow
      WHERE primary_follow.person_id = p_primary_id
        AND primary_follow.user_id = secondary_follow.user_id
    );
  UPDATE public.follows SET person_id = p_primary_id WHERE person_id = p_secondary_id;

  DELETE FROM public.profile_claims secondary_claim
  WHERE secondary_claim.person_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.profile_claims primary_claim
      WHERE primary_claim.person_id = p_primary_id
        AND primary_claim.user_id = secondary_claim.user_id
    );
  UPDATE public.profile_claims SET person_id = p_primary_id WHERE person_id = p_secondary_id;
  UPDATE public.channels SET owner_person_id = p_primary_id WHERE owner_person_id = p_secondary_id;
  UPDATE public.users SET linked_profile_id = p_primary_id WHERE linked_profile_id = p_secondary_id;
  UPDATE public.spotlights SET person_id = p_primary_id WHERE person_id = p_secondary_id;

  UPDATE public.people SET tmdb_id = NULL WHERE id = p_secondary_id AND tmdb_id = v_tmdb_id;
  UPDATE public.people SET mubi_id = NULL WHERE id = p_secondary_id AND mubi_id = v_mubi_id;

  UPDATE public.people
  SET
    name = COALESCE(NULLIF(p_metadata->>'name', ''), v_primary.name, v_secondary.name),
    bio = COALESCE(NULLIF(p_metadata->>'bio', ''), v_primary.bio, v_secondary.bio),
    photo_url = COALESCE(NULLIF(p_metadata->>'photo_url', ''), v_primary.photo_url, v_secondary.photo_url),
    date_of_birth = CASE WHEN p_metadata ? 'date_of_birth'
      THEN NULLIF(p_metadata->>'date_of_birth', '')::date
      ELSE COALESCE(v_primary.date_of_birth, v_secondary.date_of_birth) END,
    birthplace = COALESCE(NULLIF(p_metadata->>'birthplace', ''), v_primary.birthplace, v_secondary.birthplace),
    nationality = COALESCE(NULLIF(p_metadata->>'nationality', ''), v_primary.nationality, v_secondary.nationality),
    gender = COALESCE(NULLIF(p_metadata->>'gender', ''), v_primary.gender, v_secondary.gender),
    known_for_department = COALESCE(NULLIF(p_metadata->>'known_for_department', ''), v_primary.known_for_department, v_secondary.known_for_department),
    instagram_url = COALESCE(NULLIF(p_metadata->>'instagram_url', ''), v_primary.instagram_url, v_secondary.instagram_url),
    facebook_url = COALESCE(NULLIF(p_metadata->>'facebook_url', ''), v_primary.facebook_url, v_secondary.facebook_url),
    twitter_url = COALESCE(NULLIF(p_metadata->>'twitter_url', ''), v_primary.twitter_url, v_secondary.twitter_url),
    youtube_channel_id = COALESCE(NULLIF(p_metadata->>'youtube_channel_id', ''), v_primary.youtube_channel_id, v_secondary.youtube_channel_id),
    youtube_handle = COALESCE(NULLIF(p_metadata->>'youtube_handle', ''), v_primary.youtube_handle, v_secondary.youtube_handle),
    youtube_stats = COALESCE(v_primary.youtube_stats, v_secondary.youtube_stats),
    tmdb_id = v_tmdb_id,
    mubi_id = v_mubi_id,
    mubi_slug = COALESCE(v_primary.mubi_slug, v_secondary.mubi_slug),
    awards = COALESCE(v_primary.awards, '[]'::jsonb) || COALESCE(v_secondary.awards, '[]'::jsonb),
    claimed_by = COALESCE(v_primary.claimed_by, v_secondary.claimed_by),
    is_verified = COALESCE(v_primary.is_verified, false) OR COALESCE(v_secondary.is_verified, false),
    is_spotlight = COALESCE(v_primary.is_spotlight, false) OR COALESCE(v_secondary.is_spotlight, false),
    needs_review = COALESCE(v_primary.needs_review, false) OR COALESCE(v_secondary.needs_review, false),
    popularity_score = GREATEST(COALESCE(v_primary.popularity_score, 0), COALESCE(v_secondary.popularity_score, 0)),
    profile_views = COALESCE(v_primary.profile_views, 0) + COALESCE(v_secondary.profile_views, 0),
    film_count = (SELECT count(DISTINCT film_id) FROM public.credits WHERE person_id = p_primary_id),
    source = COALESCE(v_primary.source, v_secondary.source),
    status = COALESCE(v_primary.status, v_secondary.status),
    updated_at = now()
  WHERE id = p_primary_id;

  DELETE FROM public.people WHERE id = p_secondary_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_people_group(
  p_master_id uuid,
  p_duplicate_ids uuid[],
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duplicate_id uuid;
BEGIN
  IF p_master_id = ANY(p_duplicate_ids) THEN
    RAISE EXCEPTION 'The primary record cannot also be a duplicate';
  END IF;

  -- Reserve externally unique IDs before the first merge. The selected value may
  -- belong to a duplicate that appears later in the batch.
  IF p_metadata ? 'tmdb_id' AND NULLIF(p_metadata->>'tmdb_id', '') IS NOT NULL THEN
    UPDATE public.people
    SET tmdb_id = NULL
    WHERE id = ANY(p_duplicate_ids)
      AND tmdb_id = (p_metadata->>'tmdb_id')::integer;
  END IF;
  IF p_metadata ? 'mubi_id' AND NULLIF(p_metadata->>'mubi_id', '') IS NOT NULL THEN
    UPDATE public.people
    SET mubi_id = NULL
    WHERE id = ANY(p_duplicate_ids)
      AND mubi_id = (p_metadata->>'mubi_id')::integer;
  END IF;

  FOREACH duplicate_id IN ARRAY p_duplicate_ids LOOP
    PERFORM public.merge_people(p_master_id, duplicate_id, p_metadata);
  END LOOP;
END;
$$;

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

  UPDATE public.channel_videos SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.collection_films secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.collection_films primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.collection_id = secondary_row.collection_id);
  UPDATE public.collection_films SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.credits secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.credits primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.person_id = secondary_row.person_id AND primary_row.role = secondary_row.role);
  UPDATE public.credits SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_companies secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.film_companies primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.company_id = secondary_row.company_id AND primary_row.role = secondary_row.role);
  UPDATE public.film_companies SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_countries secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.film_countries primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.country_id = secondary_row.country_id);
  UPDATE public.film_countries SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.film_genres secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.film_genres primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.genre_id = secondary_row.genre_id);
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
    AND EXISTS (SELECT 1 FROM public.film_watch_links primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.url = secondary_row.url);
  UPDATE public.film_watch_links SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  UPDATE public.pending_cinema_films SET promoted_film_id = p_primary_id WHERE promoted_film_id = p_secondary_id;

  DELETE FROM public.platform_new_releases secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.platform_new_releases primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.platform = secondary_row.platform);
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
    AND EXISTS (SELECT 1 FROM public.trailer_review_queue primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.youtube_video_id = secondary_row.youtube_video_id);
  UPDATE public.trailer_review_queue SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.watchlist secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.watchlist primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.user_id = secondary_row.user_id);
  UPDATE public.watchlist SET film_id = p_primary_id WHERE film_id = p_secondary_id;

  DELETE FROM public.youtube_stats secondary_row
  WHERE secondary_row.film_id = p_secondary_id
    AND EXISTS (SELECT 1 FROM public.youtube_stats primary_row WHERE primary_row.film_id = p_primary_id AND primary_row.youtube_video_id = secondary_row.youtube_video_id);
  UPDATE public.youtube_stats SET film_id = p_primary_id WHERE film_id = p_secondary_id;
  UPDATE public.films
  SET series_id = p_primary_id
  WHERE series_id = p_secondary_id
    AND id NOT IN (p_primary_id, p_secondary_id);
  UPDATE public.films
  SET series_id = NULL
  WHERE id = p_primary_id
    AND series_id = p_secondary_id;

  UPDATE public.films SET tmdb_id = NULL WHERE id = p_secondary_id AND tmdb_id = v_tmdb_id;
  UPDATE public.films SET mubi_id = NULL WHERE id = p_secondary_id AND mubi_id = v_mubi_id;

  UPDATE public.films
  SET
    title = COALESCE(NULLIF(p_metadata->>'title', ''), v_primary.title, v_secondary.title),
    original_title = COALESCE(NULLIF(p_metadata->>'original_title', ''), v_primary.original_title, v_secondary.original_title),
    synopsis = COALESCE(NULLIF(p_metadata->>'synopsis', ''), v_primary.synopsis, v_secondary.synopsis),
    tagline = COALESCE(NULLIF(p_metadata->>'tagline', ''), v_primary.tagline, v_secondary.tagline),
    poster_url = COALESCE(NULLIF(p_metadata->>'poster_url', ''), v_primary.poster_url, v_secondary.poster_url),
    backdrop_url = COALESCE(NULLIF(p_metadata->>'backdrop_url', ''), v_primary.backdrop_url, v_secondary.backdrop_url),
    backdrop = COALESCE(v_primary.backdrop, v_secondary.backdrop),
    year = CASE WHEN p_metadata ? 'year' THEN NULLIF(p_metadata->>'year', '')::integer ELSE COALESCE(v_primary.year, v_secondary.year) END,
    release_date = CASE WHEN p_metadata ? 'release_date' THEN NULLIF(p_metadata->>'release_date', '')::date ELSE COALESCE(v_primary.release_date, v_secondary.release_date) END,
    runtime_minutes = CASE WHEN p_metadata ? 'runtime_minutes' THEN NULLIF(p_metadata->>'runtime_minutes', '')::integer ELSE COALESCE(v_primary.runtime_minutes, v_secondary.runtime_minutes) END,
    duration = COALESCE(v_primary.duration, v_secondary.duration),
    language = COALESCE(NULLIF(p_metadata->>'language', ''), v_primary.language, v_secondary.language),
    languages = COALESCE(v_primary.languages, v_secondary.languages),
    countries = COALESCE(v_primary.countries, v_secondary.countries),
    genres = COALESCE(v_primary.genres, v_secondary.genres),
    tmdb_id = v_tmdb_id,
    mubi_id = v_mubi_id,
    mubi_slug = COALESCE(v_primary.mubi_slug, v_secondary.mubi_slug),
    source = COALESCE(v_primary.source, v_secondary.source),
    source_video_id = COALESCE(v_primary.source_video_id, v_secondary.source_video_id),
    youtube_watch_url = COALESCE(v_primary.youtube_watch_url, v_secondary.youtube_watch_url),
    trailer_youtube_id = COALESCE(v_primary.trailer_youtube_id, v_secondary.trailer_youtube_id),
    trailer_external_url = COALESCE(v_primary.trailer_external_url, v_secondary.trailer_external_url),
    trailer_source = COALESCE(v_primary.trailer_source, v_secondary.trailer_source),
    release_type = COALESCE(NULLIF(p_metadata->>'release_type', ''), v_primary.release_type, v_secondary.release_type),
    content_type = COALESCE(NULLIF(p_metadata->>'content_type', ''), v_primary.content_type, v_secondary.content_type),
    status = CASE WHEN p_metadata ? 'status' THEN (p_metadata->>'status')::public.film_status ELSE COALESCE(v_primary.status, v_secondary.status) END,
    nfvcb_rating = COALESCE(v_primary.nfvcb_rating, v_secondary.nfvcb_rating),
    streaming_links = COALESCE(v_primary.streaming_links, v_secondary.streaming_links),
    awards = COALESCE(v_primary.awards, '[]'::jsonb) || COALESCE(v_secondary.awards, '[]'::jsonb),
    is_published = COALESCE(v_primary.is_published, false) OR COALESCE(v_secondary.is_published, false),
    is_featured = COALESCE(v_primary.is_featured, false) OR COALESCE(v_secondary.is_featured, false),
    is_in_cinemas = COALESCE(v_primary.is_in_cinemas, false) OR COALESCE(v_secondary.is_in_cinemas, false),
    is_nollywood = COALESCE(v_primary.is_nollywood, false) OR COALESCE(v_secondary.is_nollywood, false),
    is_top_10 = COALESCE(v_primary.is_top_10, false) OR COALESCE(v_secondary.is_top_10, false),
    is_trending = COALESCE(v_primary.is_trending, false) OR COALESCE(v_secondary.is_trending, false),
    coming_soon = COALESCE(v_primary.coming_soon, false) OR COALESCE(v_secondary.coming_soon, false),
    needs_review = COALESCE(v_primary.needs_review, false) OR COALESCE(v_secondary.needs_review, false),
    view_count = COALESCE(v_primary.view_count, 0) + COALESCE(v_secondary.view_count, 0),
    audience_rating_count = COALESCE(v_primary.audience_rating_count, 0) + COALESCE(v_secondary.audience_rating_count, 0),
    average_rating = GREATEST(COALESCE(v_primary.average_rating, 0), COALESCE(v_secondary.average_rating, 0)),
    audience_rating = COALESCE(v_primary.audience_rating, v_secondary.audience_rating),
    liked_percent = COALESCE(v_primary.liked_percent, v_secondary.liked_percent),
    tmdb_rating = COALESCE(v_primary.tmdb_rating, v_secondary.tmdb_rating),
    tmdb_vote_count = GREATEST(COALESCE(v_primary.tmdb_vote_count, 0), COALESCE(v_secondary.tmdb_vote_count, 0)),
    updated_at = now()
  WHERE id = p_primary_id;

  DELETE FROM public.films WHERE id = p_secondary_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_films_group(
  p_master_id uuid,
  p_duplicate_ids uuid[],
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  duplicate_id uuid;
BEGIN
  IF p_master_id = ANY(p_duplicate_ids) THEN
    RAISE EXCEPTION 'The primary record cannot also be a duplicate';
  END IF;

  IF p_metadata ? 'tmdb_id' AND NULLIF(p_metadata->>'tmdb_id', '') IS NOT NULL THEN
    UPDATE public.films
    SET tmdb_id = NULL
    WHERE id = ANY(p_duplicate_ids)
      AND tmdb_id = (p_metadata->>'tmdb_id')::integer;
  END IF;
  IF p_metadata ? 'mubi_id' AND NULLIF(p_metadata->>'mubi_id', '') IS NOT NULL THEN
    UPDATE public.films
    SET mubi_id = NULL
    WHERE id = ANY(p_duplicate_ids)
      AND mubi_id = (p_metadata->>'mubi_id')::integer;
  END IF;

  FOREACH duplicate_id IN ARRAY p_duplicate_ids LOOP
    PERFORM public.merge_films(p_master_id, duplicate_id, p_metadata);
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merge_people_group(uuid, uuid[], jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.merge_films_group(uuid, uuid[], jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_people_group(uuid, uuid[], jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_films_group(uuid, uuid[], jsonb) TO authenticated, service_role;
