-- ============================================================
-- MuviDB: Name-Based Slug Migration
-- Run this in Supabase SQL Editor
-- This backfills the `slug` column for all existing records
-- using human-readable names (actor name, film title).
-- New records will auto-generate slugs via triggers.
-- ============================================================

-- Step 1: Temporarily drop unique constraints and indexes to allow backfill and deduplication
ALTER TABLE films     DROP CONSTRAINT IF EXISTS films_slug_key;
ALTER TABLE people    DROP CONSTRAINT IF EXISTS people_slug_key;
ALTER TABLE channels  DROP CONSTRAINT IF EXISTS channels_slug_key;
ALTER TABLE companies DROP CONSTRAINT IF EXISTS companies_slug_key;

DROP INDEX IF EXISTS idx_films_slug;
DROP INDEX IF EXISTS idx_people_slug;
DROP INDEX IF EXISTS idx_channels_slug;
DROP INDEX IF EXISTS idx_companies_slug;

-- Step 2: Ensure slug columns exist (without UNIQUE constraint first)
ALTER TABLE films     ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE people    ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE channels  ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 3: Slug generation helper (idempotent)
CREATE OR REPLACE FUNCTION generate_slug(input TEXT) RETURNS TEXT AS $$
BEGIN
  RETURN TRIM(
    BOTH '-' FROM
    LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(TRIM(COALESCE(input, '')), '[^a-zA-Z0-9\s]', '', 'g'),
          '\s+', '-', 'g'
        ),
        '-+', '-', 'g'
      )
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Step 4: Backfill films — use title as slug, fallback to mubi_slug
UPDATE films
SET slug = generate_slug(title)
WHERE slug IS NULL OR slug = '';

-- Deduplicate film slugs (add -2, -3, etc.)
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  counter INTEGER;
BEGIN
  FOR rec IN
    SELECT id, slug FROM films
    WHERE slug IN (SELECT slug FROM films GROUP BY slug HAVING COUNT(*) > 1)
    ORDER BY created_at
  LOOP
    base_slug := rec.slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM films WHERE slug = base_slug || '-' || counter AND id != rec.id) LOOP
      counter := counter + 1;
    END LOOP;
    UPDATE films SET slug = base_slug || '-' || counter WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 5: Backfill people — use name as slug
UPDATE people
SET slug = generate_slug(name)
WHERE slug IS NULL OR slug = '';

-- Deduplicate people slugs
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  counter INTEGER;
BEGIN
  FOR rec IN
    SELECT id, slug FROM people
    WHERE slug IN (SELECT slug FROM people GROUP BY slug HAVING COUNT(*) > 1)
    ORDER BY created_at
  LOOP
    base_slug := rec.slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM people WHERE slug = base_slug || '-' || counter AND id != rec.id) LOOP
      counter := counter + 1;
    END LOOP;
    UPDATE people SET slug = base_slug || '-' || counter WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 6: Backfill channels
UPDATE channels
SET slug = generate_slug(
  COALESCE(
    NULLIF(TRIM(LEADING '@' FROM TRIM(COALESCE(channel_handle, ''))), ''),
    name
  )
)
WHERE slug IS NULL OR slug = '';

-- Deduplicate channel slugs
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  counter INTEGER;
BEGIN
  FOR rec IN
    SELECT id, slug FROM channels
    WHERE slug IN (SELECT slug FROM channels GROUP BY slug HAVING COUNT(*) > 1)
    ORDER BY created_at
  LOOP
    base_slug := rec.slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM channels WHERE slug = base_slug || '-' || counter AND id != rec.id) LOOP
      counter := counter + 1;
    END LOOP;
    UPDATE channels SET slug = base_slug || '-' || counter WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 7: Backfill companies
UPDATE companies
SET slug = generate_slug(name)
WHERE slug IS NULL OR slug = '';

-- Deduplicate company slugs
DO $$
DECLARE
  rec RECORD;
  base_slug TEXT;
  counter INTEGER;
BEGIN
  FOR rec IN
    SELECT id, slug FROM companies
    WHERE slug IN (SELECT slug FROM companies GROUP BY slug HAVING COUNT(*) > 1)
    ORDER BY created_at
  LOOP
    base_slug := rec.slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM companies WHERE slug = base_slug || '-' || counter AND id != rec.id) LOOP
      counter := counter + 1;
    END LOOP;
    UPDATE companies SET slug = base_slug || '-' || counter WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Step 8: Apply UNIQUE constraints now that data is clean
ALTER TABLE films     ADD CONSTRAINT films_slug_key UNIQUE (slug);
ALTER TABLE people    ADD CONSTRAINT people_slug_key UNIQUE (slug);
ALTER TABLE channels  ADD CONSTRAINT channels_slug_key UNIQUE (slug);
ALTER TABLE companies ADD CONSTRAINT companies_slug_key UNIQUE (slug);

-- Step 9: Create indexes
CREATE INDEX IF NOT EXISTS idx_films_slug     ON films(slug);
CREATE INDEX IF NOT EXISTS idx_people_slug    ON people(slug);
CREATE INDEX IF NOT EXISTS idx_channels_slug  ON channels(slug);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Step 10: Auto-generate slug on INSERT
CREATE OR REPLACE FUNCTION auto_slug_films() RETURNS TRIGGER AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  counter INTEGER := 2;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := generate_slug(NEW.title);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM films WHERE slug = candidate AND id != NEW.id) LOOP
      candidate := base || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_slug_people() RETURNS TRIGGER AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  counter INTEGER := 2;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := generate_slug(NEW.name);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM people WHERE slug = candidate AND id != NEW.id) LOOP
      candidate := base || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_slug_channels() RETURNS TRIGGER AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  counter INTEGER := 2;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := generate_slug(COALESCE(NULLIF(TRIM(LEADING '@' FROM TRIM(COALESCE(NEW.channel_handle, ''))), ''), NEW.name));
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM channels WHERE slug = candidate AND id != NEW.id) LOOP
      candidate := base || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auto_slug_companies() RETURNS TRIGGER AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  counter INTEGER := 2;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base := generate_slug(NEW.name);
    candidate := base;
    WHILE EXISTS (SELECT 1 FROM companies WHERE slug = candidate AND id != NEW.id) LOOP
      candidate := base || '-' || counter;
      counter := counter + 1;
    END LOOP;
    NEW.slug := candidate;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_films_slug     ON films;
DROP TRIGGER IF EXISTS trg_people_slug    ON people;
DROP TRIGGER IF EXISTS trg_channels_slug  ON channels;
DROP TRIGGER IF EXISTS trg_companies_slug ON companies;

CREATE TRIGGER trg_films_slug     BEFORE INSERT OR UPDATE OF title ON films     FOR EACH ROW EXECUTE FUNCTION auto_slug_films();
CREATE TRIGGER trg_people_slug    BEFORE INSERT OR UPDATE OF name  ON people    FOR EACH ROW EXECUTE FUNCTION auto_slug_people();
CREATE TRIGGER trg_channels_slug  BEFORE INSERT ON channels  FOR EACH ROW EXECUTE FUNCTION auto_slug_channels();
CREATE TRIGGER trg_companies_slug BEFORE INSERT ON companies FOR EACH ROW EXECUTE FUNCTION auto_slug_companies();
