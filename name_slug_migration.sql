-- ============================================================
-- MuviDB: Name-Based Slug Migration
-- Run this in Supabase SQL Editor
-- This backfills the `slug` column for all existing records
-- using human-readable names (actor name, film title).
-- New records will auto-generate slugs via triggers.
-- ============================================================

-- Step 1: Ensure slug columns exist (idempotent)
ALTER TABLE films     ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE people    ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE channels  ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE;

-- Step 2: Slug generation helper (idempotent)
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

-- Step 3: Backfill films — use title as slug, fallback to mubi_slug
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

-- Step 4: Backfill people — use name as slug
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

-- Step 5: Backfill channels
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

-- Step 6: Backfill companies
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

-- Step 7: Indexes
CREATE INDEX IF NOT EXISTS idx_films_slug     ON films(slug);
CREATE INDEX IF NOT EXISTS idx_people_slug    ON people(slug);
CREATE INDEX IF NOT EXISTS idx_channels_slug  ON channels(slug);
CREATE INDEX IF NOT EXISTS idx_companies_slug ON companies(slug);

-- Step 8: Auto-generate slug on INSERT
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

-- ============================================================
-- Verification (uncomment to check after running)
-- ============================================================
-- SELECT COUNT(*), COUNT(slug), COUNT(*) - COUNT(slug) AS missing FROM films;
-- SELECT COUNT(*), COUNT(slug), COUNT(*) - COUNT(slug) AS missing FROM people;
-- SELECT COUNT(*), COUNT(slug), COUNT(*) - COUNT(slug) AS missing FROM channels;
-- SELECT COUNT(*), COUNT(slug), COUNT(*) - COUNT(slug) AS missing FROM companies;
-- Sample check:
-- SELECT id, title, slug FROM films ORDER BY created_at DESC LIMIT 20;
-- SELECT id, name, slug FROM people ORDER BY created_at DESC LIMIT 20;
