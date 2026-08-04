-- Drop a redundant trigram index on films.title.
--
-- Two near-identical GIN trigram indexes exist:
--
--   films_title_trgm      gin (title gin_trgm_ops)         27,123 scans, 14 MB
--   films_title_trgm_idx  gin (lower(title) gin_trgm_ops)        0 scans, 14 MB
--
-- Site search (`src/lib/search.js`, `.ilike('title', '%q%')`) plans as a Bitmap
-- Index Scan on films_title_trgm — trigram matching is already case-insensitive,
-- so the lower(title) variant adds nothing the planner wants. It has gone
-- unused across 124 days of statistics (stats_reset 2026-03-30).
--
-- GIN maintenance is expensive per write and films absorbs roughly 366k writes
-- from the enrichment pipeline, so this is write cost with no read benefit.
--
-- Reversible: recreate with
--   create index films_title_trgm_idx
--     on public.films using gin (lower(title) gin_trgm_ops);

drop index if exists public.films_title_trgm_idx;
