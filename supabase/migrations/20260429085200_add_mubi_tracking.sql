ALTER TABLE films ADD COLUMN IF NOT EXISTS mubi_id BIGINT;
ALTER TABLE films ADD COLUMN IF NOT EXISTS mubi_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_films_mubi_id ON films(mubi_id);
CREATE INDEX IF NOT EXISTS idx_films_mubi_slug ON films(mubi_slug);

-- Add mubi columns to people as well for tracking
ALTER TABLE people ADD COLUMN IF NOT EXISTS mubi_id BIGINT;
ALTER TABLE people ADD COLUMN IF NOT EXISTS mubi_slug TEXT;

CREATE INDEX IF NOT EXISTS idx_people_mubi_id ON people(mubi_id);
CREATE INDEX IF NOT EXISTS idx_people_mubi_slug ON people(mubi_slug);
