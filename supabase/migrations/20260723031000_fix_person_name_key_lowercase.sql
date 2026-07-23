-- Fix person_name_key: lowercase BEFORE stripping non-alphanumerics.
-- Previous version applied [^a-z0-9]+ to mixed-case input, which deleted
-- leading capitals ("Adekola" → "dekola"). Rebuild the generated column.

CREATE OR REPLACE FUNCTION public.person_name_key(n text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH folded AS (
    SELECT regexp_replace(
      regexp_replace(
        lower(coalesce(n, '')),
        '[’‘`]',
        '''',
        'g'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
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

ALTER TABLE public.people DROP COLUMN IF EXISTS name_key;

ALTER TABLE public.people
  ADD COLUMN name_key text
  GENERATED ALWAYS AS (public.person_name_key(name)) STORED;

CREATE INDEX IF NOT EXISTS people_name_key_idx ON public.people (name_key)
  WHERE name_key IS NOT NULL;
