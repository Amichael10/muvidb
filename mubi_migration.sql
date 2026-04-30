-- ============================================
-- Mubi Integration Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Add Mubi ID columns for deduplication and deep linking
ALTER TABLE films ADD COLUMN IF NOT EXISTS mubi_id INTEGER UNIQUE;
ALTER TABLE films ADD COLUMN IF NOT EXISTS mubi_slug TEXT UNIQUE;

ALTER TABLE people ADD COLUMN IF NOT EXISTS mubi_slug TEXT UNIQUE;

-- Index for fast lookups during sync
CREATE INDEX IF NOT EXISTS idx_films_mubi_id ON films(mubi_id) WHERE mubi_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_films_mubi_slug ON films(mubi_slug) WHERE mubi_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_people_mubi_slug ON people(mubi_slug) WHERE mubi_slug IS NOT NULL;
