CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- Add GIN indexes for fast trigram similarity searches
CREATE INDEX IF NOT EXISTS people_name_trgm_idx ON public.people USING gin (name extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS films_title_trgm_idx ON public.films USING gin (title extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS channels_name_trgm_idx ON public.channels USING gin (name extensions.gin_trgm_ops);

-- RPC to match a person by fuzzy name. Returns the top match if the similarity is above the threshold.
CREATE OR REPLACE FUNCTION match_person_fuzzy(query_name text, threshold float DEFAULT 0.6)
RETURNS TABLE (id uuid, name text, sim float) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, extensions.similarity(p.name, query_name)::float as sim
  FROM public.people p
  WHERE extensions.similarity(p.name, query_name) >= threshold
  ORDER BY sim DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- RPC to match a film by fuzzy title.
CREATE OR REPLACE FUNCTION match_film_fuzzy(query_title text, threshold float DEFAULT 0.6)
RETURNS TABLE (id uuid, title text, sim float) AS $$
BEGIN
  RETURN QUERY
  SELECT f.id, f.title, extensions.similarity(f.title, query_title)::float as sim
  FROM public.films f
  WHERE extensions.similarity(f.title, query_title) >= threshold
  ORDER BY sim DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;
