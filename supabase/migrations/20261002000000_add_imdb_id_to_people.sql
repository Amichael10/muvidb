-- Migration: Add imdb_id column to people table
ALTER TABLE public.people
ADD COLUMN IF NOT EXISTS imdb_id text;

CREATE INDEX IF NOT EXISTS idx_people_imdb_id
ON public.people (imdb_id)
WHERE imdb_id IS NOT NULL;
