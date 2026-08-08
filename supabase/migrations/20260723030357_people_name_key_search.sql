-- Order-insensitive person name lookup for search / credit matching.
-- "Adekola Odunlade" and "Odunlade Adekola" share the same name_key.
-- Btree on name_key makes multi-token person search O(log n) instead of
-- flooding with OR ilike on each surname.

CREATE OR REPLACE FUNCTION public.person_name_key(n text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH folded AS (
    SELECT lower(
      regexp_replace(
        regexp_replace(coalesce(n, ''), '[’‘`]', '''', 'g'),
        '[^a-z0-9]+',
        ' ',
        'g'
      )
    ) AS s
  ),
  tokens AS (
    SELECT t
    FROM folded,
    LATERAL unnest(regexp_split_to_array(trim(s), '\s+')) AS t
    WHERE length(t) > 0
      AND t NOT IN (
        'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
        'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
        'princess', 'producer', 'sir', 'official', 'and'
      )
  ),
  ordered AS (
    SELECT array_agg(t ORDER BY t) AS arr
    FROM tokens
  )
  SELECT CASE
    WHEN arr IS NULL OR cardinality(arr) < 2 THEN NULL
    ELSE cardinality(arr)::text || ':' || array_to_string(arr, '|')
  END
  FROM ordered;
$$;

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS name_key text
  GENERATED ALWAYS AS (public.person_name_key(name)) STORED;

CREATE INDEX IF NOT EXISTS people_name_key_idx ON public.people (name_key)
  WHERE name_key IS NOT NULL;

-- Faster multi-token + order-insensitive people search.
-- Returns rows ranked: exact key match first, then trigram similarity.
CREATE OR REPLACE FUNCTION public.search_people_fuzzy(q text, lim int DEFAULT 20)
RETURNS SETOF public.people
LANGUAGE sql
STABLE
SET search_path = public, extensions
AS $$
  WITH qkey AS (
    SELECT public.person_name_key(q) AS key
  )
  SELECT p.*
  FROM public.people p
  CROSS JOIN qkey
  WHERE
    (qkey.key IS NOT NULL AND p.name_key = qkey.key)
    OR p.name % q
  ORDER BY
    CASE WHEN qkey.key IS NOT NULL AND p.name_key = qkey.key THEN 0 ELSE 1 END,
    similarity(p.name, q) DESC NULLS LAST
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.person_name_key(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_people_fuzzy(text, int) TO anon, authenticated;
