-- Drop an unused GIN index on films.streaming_links.
--
-- pg_stat_user_indexes reports 0 scans against 124 days of statistics
-- (stats_reset 2026-03-30). The only query that filters on this column is
-- AdminFilms.jsx, which uses `streaming_links->platform IS NOT NULL`. GIN
-- indexes serve containment operators (@>, ?, ?&, ?|), not `->` with a null
-- test, so the planner could never have used it.
--
-- GIN maintenance is unusually expensive per write, and films absorbs roughly
-- 366k writes from the enrichment pipeline. Removing it reduces that cost with
-- no read-path impact.
--
-- Reversible: recreate with
--   create index idx_films_streaming_links_gin
--     on public.films using gin (streaming_links);

drop index if exists public.idx_films_streaming_links_gin;
