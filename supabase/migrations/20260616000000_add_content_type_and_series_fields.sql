-- Add content_type to distinguish movies from series
ALTER TABLE films ADD COLUMN IF NOT EXISTS content_type text DEFAULT 'movie'
  CHECK (content_type IN ('movie', 'series', 'mini_series', 'documentary'));

-- Series metadata
ALTER TABLE films ADD COLUMN IF NOT EXISTS season_count integer;
ALTER TABLE films ADD COLUMN IF NOT EXISTS episode_count integer;

-- Self-referential: episode records point to their parent series record
ALTER TABLE films ADD COLUMN IF NOT EXISTS series_id uuid REFERENCES films(id) ON DELETE SET NULL;
ALTER TABLE films ADD COLUMN IF NOT EXISTS episode_number integer;
ALTER TABLE films ADD COLUMN IF NOT EXISTS season_number integer;

-- Backfill: mark known series from Netflix/streaming platforms using title patterns
UPDATE films SET content_type = 'series'
WHERE content_type = 'movie'
  AND (
    -- Series with explicit markers in title
    title ~* '\y(season|episode|ep\s?\d|volume|vol\s?\d|part\s?\d)\y'
    -- No runtime = likely a series
    OR (runtime_minutes IS NULL AND release_type IN ('netflix', 'prime_video', 'showmax', 'mubi', 'ebonylife'))
    -- Known series keywords in synopsis
    OR synopsis ~* '\y(seasons|episodes|series finale|season \d|episode \d)\y'
  );

-- Also backfill using the existing type column if populated (netflix_sync stores it as 'series')
UPDATE films SET content_type = 'series'
WHERE content_type = 'movie'
  AND source = 'netflix'
  AND runtime_minutes IS NULL;

-- Indexes for fast filtering
CREATE INDEX IF NOT EXISTS films_content_type_idx ON films(content_type);
CREATE INDEX IF NOT EXISTS films_series_id_idx ON films(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS films_content_type_release_idx ON films(content_type, release_type);
