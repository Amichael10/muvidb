-- Drop the unused 'biography' column from the 'people' table to prevent future confusion.
-- The 'bio' column is the canonical column for storing biographies.

ALTER TABLE people
DROP COLUMN IF EXISTS biography;
