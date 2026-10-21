-- Actually restrict anon to the public columns on films and people.
--
-- 20261021140254 tried to do this with column-level revokes alone and was a
-- no-op: `anon` still held a TABLE-level SELECT grant, and in Postgres a
-- table-level grant covers every column (including ones added later), so
-- `revoke select (col)` cannot carve an exception out of it. All twelve
-- columns still returned 200 afterwards.
--
-- The working shape is the one 20261021064457 used on talent_representations
-- and person_aliases: drop the table-wide grant, then re-grant exactly the
-- columns anon is allowed to read.
--
-- Column lists generated from the live schema rather than hand-typed, and
-- checked so that none of the withheld columns appears in a grant list.
--
-- Withheld from anon (zero references anywhere in src/):
--   people  pro_plan, pro_expires_at          -- billing
--           photo_cutout_attempted_at, photo_cutout_error,
--           photo_cutout_source_url            -- internal image pipeline
--           management_company_id              -- internal linkage
--   films   content_kind, content_kind_checked_at,
--           content_kind_confidence            -- AI classifier internals
--           comments_synced_at, nfvcb_rating_verified_at,
--           nfvcb_rating_source                -- internal provenance
--
-- `authenticated` and `service_role` are untouched and keep full table SELECT,
-- so admin screens, the company roster editor, every api/ function and all SSR
-- loaders behave exactly as before.
--
-- CONSEQUENCE worth knowing: anon is now deny-by-default on these two tables.
-- A column added later is NOT readable by anon until it is granted here, and
-- `select=*` returns 401 for anon. Both are intentional. The public pages were
-- moved onto explicit column lists first (src/lib/publicSelects.ts, verified
-- live in assets/publicSelects-DL8HRCzM.js) precisely so this is safe.
--
-- Rollback:
--   grant select on public.people to anon;
--   grant select on public.films  to anon;

◇ injected env (106) from .env.local // tip: ◈ encrypted .env [www.dotenvx.com]
◇ injected env (7) from .env // tip: ⌁ auth for agents [www.vestauth.com]
revoke select on public.people from anon;
grant select (
  availability_note,
  availability_status,
  awards,
  bio,
  birthplace,
  booking_email,
  booking_phone,
  booking_whatsapp,
  claimed_by,
  created_at,
  date_of_birth,
  date_of_death,
  death_month,
  death_year,
  facebook_url,
  film_count,
  gender,
  headshots,
  id,
  imdb_id,
  instagram_url,
  is_deceased,
  is_pro,
  is_spotlight,
  is_verified,
  known_for_department,
  mubi_id,
  mubi_slug,
  name,
  name_key,
  nationality,
  needs_review,
  photo_cutout_status,
  photo_cutout_url,
  photo_url,
  popularity_score,
  profile_views,
  showreel_urls,
  slug,
  source,
  status,
  tiktok_url,
  tmdb_id,
  twitter_url,
  updated_at,
  view_count_total,
  view_count_weekly,
  youtube_channel_id,
  youtube_handle,
  youtube_stats
) on public.people to anon;

revoke select on public.films from anon;
grant select (
  audience_rating,
  audience_rating_count,
  average_rating,
  awards,
  backdrop,
  backdrop_url,
  box_office_currency,
  box_office_domestic,
  box_office_opening_weekend,
  box_office_source,
  box_office_updated_at,
  box_office_worldwide,
  budget,
  coming_soon,
  content_type,
  countries,
  created_at,
  distributor,
  duration,
  episode_count,
  episode_number,
  genres,
  id,
  imdb_id,
  imdb_rating,
  imdb_vote_count,
  is_featured,
  is_in_cinemas,
  is_nollywood,
  is_published,
  is_top_10,
  is_trending,
  language,
  languages,
  liked_percent,
  mubi_id,
  mubi_slug,
  needs_review,
  nfvcb_rating,
  original_title,
  poster_url,
  release_date,
  release_type,
  runtime_minutes,
  season_count,
  season_number,
  series_id,
  slug,
  source,
  source_video_id,
  status,
  streaming_links,
  synopsis,
  tagline,
  title,
  title_locked,
  tmdb_id,
  tmdb_rating,
  tmdb_vote_count,
  trailer_external_url,
  trailer_source,
  trailer_youtube_id,
  updated_at,
  view_count,
  year,
  youtube_watch_url
) on public.films to anon;

