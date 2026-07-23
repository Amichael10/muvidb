-- =============================================================================
-- merge_companies — fold a duplicate company into the primary, moving its films.
-- =============================================================================
-- Companies appear 2-3x (case/spacing/punctuation variants: "Larry Gee Films"
-- twice, "Ola-Oye Ventures" / "Ola Oye Ventures"). Merging must reassign every
-- film_companies link AND channels.owner_company_id to the survivor, dedupe the
-- join rows, keep the primary's identity, and release UNIQUE fields off the
-- secondary first (same mubi_slug/slug hazard that broke merge_people).
--
--   merge_companies(primary_id, secondary_id, metadata)  -> void
--   merge_companies_group(master_id, duplicate_ids[])     -> void
-- =============================================================================

CREATE OR REPLACE FUNCTION public.merge_companies(
  p_primary_id uuid,
  p_secondary_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary public.companies%ROWTYPE;
  v_secondary public.companies%ROWTYPE;
  v_tmdb_id integer;
BEGIN
  IF p_primary_id IS NULL OR p_secondary_id IS NULL OR p_primary_id = p_secondary_id THEN
    RAISE EXCEPTION 'Primary and secondary companies must be different records';
  END IF;

  IF auth.role() <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid() AND users.role IN ('admin', 'admin_limited')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT * INTO v_primary FROM public.companies WHERE id = p_primary_id FOR UPDATE;
  SELECT * INTO v_secondary FROM public.companies WHERE id = p_secondary_id FOR UPDATE;
  IF v_primary.id IS NULL OR v_secondary.id IS NULL THEN
    RAISE EXCEPTION 'One or more company records no longer exist';
  END IF;

  IF v_primary.tmdb_id IS NOT NULL AND v_secondary.tmdb_id IS NOT NULL
     AND v_primary.tmdb_id <> v_secondary.tmdb_id AND NOT (p_metadata ? 'tmdb_id') THEN
    RAISE EXCEPTION 'Merge blocked: select which TMDB ID to retain';
  END IF;
  v_tmdb_id := CASE WHEN p_metadata ? 'tmdb_id'
    THEN NULLIF(p_metadata->>'tmdb_id', '')::integer
    ELSE COALESCE(v_primary.tmdb_id, v_secondary.tmdb_id) END;

  -- Move film links; drop rows that would collide on (film_id, company_id, role).
  DELETE FROM public.film_companies sec
  WHERE sec.company_id = p_secondary_id
    AND EXISTS (
      SELECT 1 FROM public.film_companies pri
      WHERE pri.film_id = sec.film_id
        AND pri.company_id = p_primary_id
        AND pri.role IS NOT DISTINCT FROM sec.role
    );
  UPDATE public.film_companies SET company_id = p_primary_id WHERE company_id = p_secondary_id;

  -- Reassign any channels owned by the secondary.
  UPDATE public.channels SET owner_company_id = p_primary_id WHERE owner_company_id = p_secondary_id;

  -- Free UNIQUE-ish identifiers on the secondary before the primary claims them.
  UPDATE public.companies SET tmdb_id = NULL WHERE id = p_secondary_id AND tmdb_id = v_tmdb_id;
  UPDATE public.companies SET mubi_slug = NULL, slug = NULL WHERE id = p_secondary_id;

  -- Fill only-empty primary fields from the secondary; primary identity wins.
  UPDATE public.companies
  SET
    description   = COALESCE(v_primary.description, v_secondary.description),
    logo_url      = COALESCE(v_primary.logo_url, v_secondary.logo_url),
    website       = COALESCE(v_primary.website, v_secondary.website),
    founded_year  = COALESCE(v_primary.founded_year, v_secondary.founded_year),
    tmdb_id       = v_tmdb_id,
    headquarters  = COALESCE(v_primary.headquarters, v_secondary.headquarters),
    focus         = COALESCE(v_primary.focus, v_secondary.focus),
    years_active  = COALESCE(v_primary.years_active, v_secondary.years_active),
    employees     = COALESCE(v_primary.employees, v_secondary.employees),
    languages     = COALESCE(v_primary.languages, v_secondary.languages),
    instagram_url = COALESCE(v_primary.instagram_url, v_secondary.instagram_url),
    twitter_url   = COALESCE(v_primary.twitter_url, v_secondary.twitter_url),
    youtube_url   = COALESCE(v_primary.youtube_url, v_secondary.youtube_url),
    company_type  = COALESCE(v_primary.company_type, v_secondary.company_type),
    updated_at    = now()
  WHERE id = p_primary_id;

  DELETE FROM public.companies WHERE id = p_secondary_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.merge_companies_group(
  p_master_id uuid,
  p_duplicate_ids uuid[],
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dup uuid;
BEGIN
  IF p_master_id = ANY(p_duplicate_ids) THEN
    RAISE EXCEPTION 'The primary record cannot also be a duplicate';
  END IF;
  FOREACH dup IN ARRAY p_duplicate_ids LOOP
    PERFORM public.merge_companies(p_master_id, dup, p_metadata);
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_companies(uuid, uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.merge_companies_group(uuid, uuid[], jsonb) TO authenticated, service_role;
