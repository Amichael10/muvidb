-- Migration to allow flexible roles in the credits table
-- This allows harvesting detailed crew information (Makeup, Gaffer, etc.) 
-- without being restricted by a fixed enum.

-- 1. Drop the constraint if it exists (usually implicit for enums)
-- Actually, we just change the column type to text.
ALTER TABLE credits ALTER COLUMN role TYPE text;

-- 2. (Optional) We can still keep the enum for reference but the column is now free-form.
-- This ensures that when we scrape "Makeup Artist" or "Location Driver", it just works.
