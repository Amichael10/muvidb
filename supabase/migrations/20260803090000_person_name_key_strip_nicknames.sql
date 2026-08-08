-- Strip parenthetical / bracket nicknames before building people.name_key.
-- OCR and credit cards often append "(Supa)", "[DJ]", etc. Without this,
-- "Marian Abiodun (Supa)" and "Abiodun Marian" get different keys and miss.

CREATE OR REPLACE FUNCTION public.person_name_key(n text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT regexp_replace(
      regexp_replace(coalesce(n, ''), '\([^)]*\)', ' ', 'g'),
      '\[[^\]]*\]',
      ' ',
      'g'
    ) AS raw
  ),
  folded AS (
    SELECT regexp_replace(
      regexp_replace(
        lower(raw),
        '[’‘`]',
        '''',
        'g'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    ) AS s
    FROM cleaned
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

-- Generated column already calls person_name_key(name); replacing the function
-- is enough for new writes. Force a rebuild so existing rows recompute keys.
ALTER TABLE public.people DROP COLUMN IF EXISTS name_key;

ALTER TABLE public.people
  ADD COLUMN name_key text
  GENERATED ALWAYS AS (public.person_name_key(name)) STORED;

CREATE INDEX IF NOT EXISTS people_name_key_idx ON public.people (name_key)
  WHERE name_key IS NOT NULL;
