-- ==============================================================================
-- update_channels.sql — Run this in your Supabase SQL Editor to support Yoruba, Hausa, Igbo rows
-- ==============================================================================

-- 1. Add the primary_language column to the channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS primary_language text DEFAULT 'English';

-- 2. Add composite index for films table to optimize home feed query under RLS from 13s to under 10ms
CREATE INDEX IF NOT EXISTS films_source_created_at_idx ON films (source, created_at DESC);

-- 3. Set primary language for existing culturally specific Nollywood channels (examples)
UPDATE channels SET primary_language = 'Yoruba' WHERE name ILIKE '%yoruba%';
UPDATE channels SET primary_language = 'Hausa' WHERE name ILIKE '%hausa%' OR name ILIKE '%kannywood%';
UPDATE channels SET primary_language = 'Igbo' WHERE name ILIKE '%igbo%';
UPDATE channels SET primary_language = 'English' WHERE primary_language IS NULL;
