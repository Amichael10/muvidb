-- =============================================================================
-- 20260709000000_search_trigram_indexes.sql
-- Makes search fast and typo-tolerant.
--
-- The app searches films/people/companies with `name ILIKE '%term%'`. A leading
-- wildcard can't use a btree index, so those queries seq-scan and hit the
-- statement timeout on big tables (why search "failed"/was flaky). pg_trgm GIN
-- indexes make substring ILIKE fast, and the `%` similarity operator adds typo
-- tolerance (used by the search_*_fuzzy RPCs below).
--
-- Run once in the Supabase SQL editor (or `supabase db push`). CREATE INDEX
-- CONCURRENTLY can't run in a txn; if the editor complains, drop CONCURRENTLY.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS films_title_trgm     ON public.films     USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS people_name_trgm     ON public.people    USING gin (name  gin_trgm_ops);
CREATE INDEX IF NOT EXISTS companies_name_trgm  ON public.companies USING gin (name  gin_trgm_ops);

-- Fuzzy (typo-tolerant) lookups, ranked by trigram similarity. The client calls
-- these only to top up thin results, so they degrade gracefully if absent.
CREATE OR REPLACE FUNCTION public.search_people_fuzzy(q text, lim int DEFAULT 20)
RETURNS SETOF public.people LANGUAGE sql STABLE
SET search_path = public AS $$
  SELECT * FROM public.people
  WHERE name % q
  ORDER BY similarity(name, q) DESC
  LIMIT lim;
$$;

CREATE OR REPLACE FUNCTION public.search_films_fuzzy(q text, lim int DEFAULT 20)
RETURNS SETOF public.films LANGUAGE sql STABLE
SET search_path = public AS $$
  SELECT * FROM public.films
  WHERE title % q
  ORDER BY similarity(title, q) DESC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.search_people_fuzzy(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_films_fuzzy(text, int)  TO anon, authenticated;
