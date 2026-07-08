-- =============================================================================
-- 20260708000000_external_reviews_and_audience_rating.sql
-- Extends `reviews` to hold third-party reviews (YouTube comments, later TMDB),
-- and adds an audience rating on `films` derived from YouTube comment sentiment.
--
-- Writes are done by the sync (service_role, bypasses RLS); the existing
-- "Allow public read access" policy already exposes these rows to the site.
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- =============================================================================

-- 1. reviews: allow non-user (external) authors -------------------------------
ALTER TABLE public.reviews
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS source            text NOT NULL DEFAULT 'user', -- 'user' | 'youtube' | 'tmdb'
  ADD COLUMN IF NOT EXISTS author_name       text,        -- external reviewer display name (non-clickable)
  ADD COLUMN IF NOT EXISTS author_avatar_url text,
  ADD COLUMN IF NOT EXISTS source_url        text,        -- link to the original comment/review
  ADD COLUMN IF NOT EXISTS external_id       text,        -- YouTube comment id / TMDB review id (dedup key)
  ADD COLUMN IF NOT EXISTS sentiment_score   numeric,     -- AI 1-10 score for this single comment
  ADD COLUMN IF NOT EXISTS likes             integer NOT NULL DEFAULT 0;

-- Dedup: never import the same external comment twice for a film.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_film_external_uidx
  ON public.reviews (film_id, external_id)
  WHERE external_id IS NOT NULL;

-- Fast fetch of external reviews per film, best (most-liked) first.
CREATE INDEX IF NOT EXISTS reviews_film_source_likes_idx
  ON public.reviews (film_id, source, likes DESC);

-- 2. films: audience rating from YouTube comment sentiment --------------------
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS audience_rating       numeric,  -- likes-weighted mean of comment sentiment (0-10)
  ADD COLUMN IF NOT EXISTS audience_rating_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_synced_at    timestamptz; -- when we last mined comments for this film
