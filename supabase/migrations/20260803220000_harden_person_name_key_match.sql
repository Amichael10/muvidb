-- Harden person_name_key for OCR credit rolls:
--   - strip "(nickname)" / "[DJ]"
--   - strip leading numbering ("1. ", "12) ", "#3 ")
--   - drop more credit-noise words (as, starring, featuring, …)
-- Rebuild the generated column so existing rows recompute.

CREATE OR REPLACE FUNCTION public.person_name_key(n text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(n, ''), '\([^)]*\)', ' ', 'g'),
        '\[[^\]]*\]',
        ' ',
        'g'
      ),
      -- credit-roll numbering / bullets at the start of the string or a token
      '(^|[[:space:]])[0-9]{1,3}[\.\)\-:][[:space:]]*',
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
    WHERE length(t) > 1
      AND t !~ '^[0-9]+$'
      AND t NOT IN (
        'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
        'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
        'princess', 'producer', 'sir', 'official', 'and', 'as', 'with', 'feat',
        'featuring', 'starring', 'also', 'aka', 'the', 'of', 'jr', 'jnr', 'snr',
        'sr', 'ii', 'iii', 'iv'
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

-- Return matching people rows for admin OCR / typeahead (order-insensitive).
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
           ELSE 'other'
         END AS match_kind
  FROM public.people p, q
  WHERE q.raw <> ''
    AND (
      lower(p.name) = q.folded
      OR (q.key IS NOT NULL AND p.name_key = q.key)
    )
  ORDER BY
    CASE WHEN lower(p.name) = q.folded THEN 0 ELSE 1 END,
    p.film_count DESC NULLS LAST,
    (p.photo_url IS NOT NULL) DESC,
    p.name
  LIMIT greatest(1, least(coalesce(p_limit, 8), 50));
$$;

COMMENT ON FUNCTION public.match_people_by_name(text, int) is
  'Order-insensitive person lookup for OCR/search. Exact fold first, then name_key swap.';

GRANT EXECUTE ON FUNCTION public.match_people_by_name(text, int) TO anon, authenticated;
