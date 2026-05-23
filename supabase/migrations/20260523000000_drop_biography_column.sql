-- Migrate data from biography to bio if bio is null and biography is not null
UPDATE people
SET bio = biography
WHERE bio IS NULL AND biography IS NOT NULL;

-- Drop the unused 'biography' column from the 'people' table to prevent future confusion.
-- The 'bio' column is the canonical column for storing biographies.
ALTER TABLE people
DROP COLUMN IF EXISTS biography;
