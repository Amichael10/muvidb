-- ==============================================================================
-- 20260530000000_spotlight_films.sql — Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Add featured_film_ids column to the spotlights table to hold up to 4 film UUIDs
ALTER TABLE public.spotlights ADD COLUMN IF NOT EXISTS featured_film_ids UUID[] DEFAULT '{}';

-- 2. Add an optional comment explaining the field's purpose
COMMENT ON COLUMN public.spotlights.featured_film_ids IS 'List of film IDs selected by the admin to display as Featured Works in the Spotlight section.';
