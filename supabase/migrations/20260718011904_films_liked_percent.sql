-- =============================================================================
-- UNIFIED RATING — liked_percent (Rotten-Tomatoes-style "% liked")
-- =============================================================================
-- One rating metric across the whole site instead of three inconsistent 1-10
-- fields. "% of the audience that responded positively", computed the same way
-- for every film:
--   * TMDB films  -> map the 0-10 average through a calibrated curve.
--   * comment films -> de-inflated positive share from mined YouTube comments.
--   * everything else -> NULL (show views, never a fake number).
-- Population is done by api/_lib/comment_reviews.ts (comments) + the TMDB sync
-- + a one-off backfill. The old average_rating field is abandoned (41k zeros).
-- =============================================================================

alter table public.films
  add column if not exists liked_percent smallint;

comment on column public.films.liked_percent is
  'Unified 0-100 "% liked" audience score. From TMDB rating (mapped) or mined comment sentiment (de-inflated). NULL = not enough signal; show engagement instead.';
