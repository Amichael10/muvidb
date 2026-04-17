-- ============================================
-- TMDB Integration Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Add TMDB ID columns for deduplication
ALTER TABLE films ADD COLUMN IF NOT EXISTS tmdb_id INTEGER UNIQUE;
ALTER TABLE films ADD COLUMN IF NOT EXISTS tmdb_rating NUMERIC(3,1);
ALTER TABLE films ADD COLUMN IF NOT EXISTS tagline TEXT;

ALTER TABLE people ADD COLUMN IF NOT EXISTS tmdb_id INTEGER UNIQUE;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS tmdb_id INTEGER UNIQUE;

-- Index for fast lookups during sync
CREATE INDEX IF NOT EXISTS idx_films_tmdb_id ON films(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_tmdb_id ON people(tmdb_id) WHERE tmdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_tmdb_id ON companies(tmdb_id) WHERE tmdb_id IS NOT NULL;
