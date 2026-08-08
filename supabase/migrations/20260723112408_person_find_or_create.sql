-- =============================================================================
-- ONE canonical person lookup / find-or-create, usable from ANY language.
-- =============================================================================
-- people.name_key (order-insensitive, honorific-stripped) already exists, but
-- nothing that CREATES people used it — 13+ call sites across Python OCR, the
-- API handlers, cinema (circuits_sync), streaming (ebonylife_sync), TMDB and
-- awards each did their own `name ilike '<name>'` and inserted on miss. That is
-- why "Prince Jide Kosoko" / "Kosoko Jide" kept becoming new rows even though
-- "Jide Kosoko" existed, and why dedupe had to be run daily.
--
-- Two functions so every caller can share the same matching rules:
--   find_person_by_name(name)            -> uuid | NULL   (lookup only)
--   upsert_person_by_name(name, extra)   -> uuid          (atomic find-or-create)
--
-- Matching order:
--   1. exact case-insensitive name
--   2. name_key  (handles order swaps + honorifics: "Prince Jide Kosoko")
-- Ties break on REAL credit count (people.film_count is stale and untrustworthy),
-- so the richest record wins and credits keep accumulating on one profile.
--
-- NOTE: deliberately NO substring/fuzzy matching here. film_enrichment.ts used
-- `ilike '%name%'`, which lets a new person "Jide" attach to "Jide Kosoko" —
-- silently mis-crediting, which is worse than a duplicate.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.find_person_by_name(p_name text)
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT trim(coalesce(p_name, '')) AS raw,
           lower(trim(coalesce(p_name, ''))) AS folded,
           public.person_name_key(p_name) AS key
  )
  SELECT p.id
  FROM public.people p, q
  WHERE q.raw <> ''
    AND (
      lower(p.name) = q.folded
      OR (q.key IS NOT NULL AND p.name_key = q.key)
    )
  ORDER BY
    -- exact spelling wins over an order-swap/honorific match
    CASE WHEN lower(p.name) = q.folded THEN 0 ELSE 1 END,
    (SELECT count(*) FROM public.credits c WHERE c.person_id = p.id) DESC,
    (p.photo_url IS NOT NULL) DESC,
    p.created_at ASC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.upsert_person_by_name(
  p_name text,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_name text := trim(coalesce(p_name, ''));
BEGIN
  IF v_name = '' THEN
    RETURN NULL;
  END IF;

  v_id := public.find_person_by_name(v_name);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.people (name, nationality, source, photo_url, known_for_department)
  VALUES (
    v_name,
    coalesce(nullif(p_extra->>'nationality', ''), 'Nigerian'),
    nullif(p_extra->>'source', ''),
    nullif(p_extra->>'photo_url', ''),
    nullif(p_extra->>'known_for_department', '')
  )
  RETURNING id INTO v_id;

  RETURN v_id;
EXCEPTION
  -- Lost a race with a concurrent insert of the same person: re-resolve.
  WHEN unique_violation THEN
    RETURN public.find_person_by_name(v_name);
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_person_by_name(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_person_by_name(text, jsonb) TO authenticated, service_role;
