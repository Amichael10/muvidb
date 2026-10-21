/**
 * Explicit column lists for anon-reachable reads of `films` and `people`.
 *
 * WHY THIS EXISTS — please don't replace these with `*`.
 *
 * PostgREST returns 401 for the ENTIRE query when any requested column lacks
 * SELECT privilege. `select('*')` therefore requests every column including the
 * internal ones, which makes it impossible to revoke anon access to anything
 * without breaking the page. Revoking a column while a deployed bundle still
 * asked for it is exactly what broke person-page navigation on 2026-10-21.
 *
 * Each list is "every column on the table MINUS the internal ones", generated
 * from the live schema rather than hand-written, so no field a component reads
 * can be dropped by accident. Behaviour is identical to `*` apart from the
 * omitted columns, which nothing in src/ references.
 *
 * Omitted from people (all zero references in src/):
 *   pro_plan, pro_expires_at        -- billing: which plan, and when it expires
 *   photo_cutout_attempted_at       -- image pipeline bookkeeping
 *   photo_cutout_error
 *   photo_cutout_source_url
 *   management_company_id
 *
 * Omitted from films (all zero references in src/):
 *   content_kind                    -- internal AI classification
 *   content_kind_checked_at
 *   content_kind_confidence         -- how sure the classifier was
 *   comments_synced_at              -- pipeline bookkeeping
 *   nfvcb_rating_verified_at
 *   nfvcb_rating_source
 *
 * Adding a column to the table does NOT add it here. That is deliberate: a new
 * column is private until someone decides it is public and adds it below.
 */

/** 50 of people's 56 columns. */
export const PUBLIC_PERSON_COLUMNS = [
  'id', 'slug', 'name', 'name_key', 'bio', 'birthplace', 'nationality', 'gender',
  'date_of_birth', 'date_of_death', 'death_month', 'death_year', 'is_deceased',
  'known_for_department', 'film_count', 'popularity_score',
  'photo_url', 'photo_cutout_status', 'photo_cutout_url', 'headshots',
  'is_verified', 'is_spotlight', 'is_pro', 'claimed_by', 'needs_review', 'status', 'source',
  'availability_status', 'availability_note',
  'booking_email', 'booking_phone', 'booking_whatsapp',
  'awards', 'showreel_urls',
  'instagram_url', 'twitter_url', 'facebook_url', 'tiktok_url',
  'youtube_handle', 'youtube_channel_id', 'youtube_stats',
  'imdb_id', 'tmdb_id', 'mubi_id', 'mubi_slug',
  'profile_views', 'view_count_total', 'view_count_weekly',
  'created_at', 'updated_at',
].join(', ');

/** 66 of films' 72 columns. */
export const PUBLIC_FILM_COLUMNS = [
  'id', 'slug', 'title', 'original_title', 'tagline', 'synopsis',
  'year', 'release_date', 'release_type', 'content_type', 'coming_soon',
  'runtime_minutes', 'duration', 'language', 'languages', 'countries', 'genres',
  'poster_url', 'backdrop_url', 'backdrop',
  'trailer_youtube_id', 'trailer_external_url', 'trailer_source', 'youtube_watch_url',
  'streaming_links', 'is_in_cinemas', 'distributor',
  'average_rating', 'audience_rating', 'audience_rating_count', 'liked_percent',
  'imdb_rating', 'imdb_vote_count', 'tmdb_rating', 'tmdb_vote_count',
  'view_count', 'budget',
  'box_office_domestic', 'box_office_worldwide', 'box_office_opening_weekend',
  'box_office_currency', 'box_office_source', 'box_office_updated_at',
  'nfvcb_rating', 'awards',
  'is_featured', 'is_top_10', 'is_trending', 'is_nollywood', 'is_published',
  'needs_review', 'title_locked', 'status', 'source', 'source_video_id',
  'series_id', 'season_count', 'season_number', 'episode_count', 'episode_number',
  'imdb_id', 'tmdb_id', 'mubi_id', 'mubi_slug',
  'created_at', 'updated_at',
].join(', ');
