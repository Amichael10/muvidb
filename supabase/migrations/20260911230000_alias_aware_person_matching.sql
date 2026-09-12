-- Alias-aware Person Matching & Search Enhancements
-- Enables match_people_by_name and search routines to resolve aliases seamlessly

CREATE INDEX IF NOT EXISTS idx_person_aliases_alias_key ON public.person_aliases (alias_key);
CREATE INDEX IF NOT EXISTS idx_person_aliases_person_id ON public.person_aliases (person_id);
CREATE INDEX IF NOT EXISTS idx_person_aliases_alias_trgm ON public.person_aliases USING gin (alias gin_trgm_ops);

-- Enhanced match_people_by_name: checks exact name, name_key swap, and person_aliases
CREATE OR REPLACE FUNCTION public.match_people_by_name(
  p_name text,
  p_limit int DEFAULT 8
)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  photo_url text,
  film_count integer,
  match_kind text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH q AS (
    SELECT trim(coalesce(p_name, '')) AS raw,
           lower(trim(coalesce(p_name, ''))) AS folded,
           lower(regexp_replace(trim(coalesce(p_name, '')), '[^a-zA-Z0-9]+', '', 'g')) AS a_key,
           public.person_name_key(p_name) AS key
  )
  SELECT p.id,
         p.name,
         p.slug,
         p.photo_url,
         p.film_count,
         CASE
           WHEN lower(p.name) = q.folded THEN 'exact'
           WHEN q.key IS NOT NULL AND p.name_key = q.key THEN 'name_key'
           WHEN EXISTS (
             SELECT 1 FROM public.person_aliases pa 
             WHERE pa.person_id = p.id 
               AND (pa.alias_key = q.a_key OR lower(pa.alias) = q.folded)
           ) THEN 'alias'
           ELSE 'other'
         END AS match_kind
  FROM public.people p, q
  WHERE q.raw <> ''
    AND (
      lower(p.name) = q.folded
      OR (q.key IS NOT NULL AND p.name_key = q.key)
      OR EXISTS (
        SELECT 1 FROM public.person_aliases pa 
        WHERE pa.person_id = p.id 
          AND (pa.alias_key = q.a_key OR lower(pa.alias) = q.folded)
      )
    )
  ORDER BY
    CASE 
      WHEN lower(p.name) = q.folded THEN 0 
      WHEN EXISTS (
        SELECT 1 FROM public.person_aliases pa 
        WHERE pa.person_id = p.id 
          AND (pa.alias_key = q.a_key OR lower(pa.alias) = q.folded)
      ) THEN 1
      ELSE 2 
    END,
    p.film_count DESC NULLS LAST,
    (p.photo_url IS NOT NULL) DESC,
    p.name
  LIMIT greatest(1, least(coalesce(p_limit, 8), 50));
$$;

COMMENT ON FUNCTION public.match_people_by_name(text, int) is
  'Order-insensitive and alias-aware person lookup for OCR, search and auto-link.';

GRANT EXECUTE ON FUNCTION public.match_people_by_name(text, int) TO anon, authenticated, service_role;
