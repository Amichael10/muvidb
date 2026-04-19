-- ============================================================
-- fix-showtimes-index.sql  —  run in Supabase SQL Editor
-- ============================================================
-- The original unique index used COALESCE(format, 'Standard') which Postgres
-- can't match via ON CONFLICT in supabase-js. Rebuild as a plain tuple.
-- ============================================================

-- 1. Normalise any NULL formats, then enforce NOT NULL + default
UPDATE showtimes SET format = 'Standard' WHERE format IS NULL;
ALTER TABLE showtimes ALTER COLUMN format SET DEFAULT 'Standard';
ALTER TABLE showtimes ALTER COLUMN format SET NOT NULL;

-- 2. Drop the old expression-based unique index and create a plain one
DROP INDEX IF EXISTS showtimes_cinema_film_date_time_fmt_uidx;

CREATE UNIQUE INDEX showtimes_cinema_film_date_time_fmt_uidx
  ON showtimes (cinema_id, film_id, show_date, show_time, format);
