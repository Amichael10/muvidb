-- Handle Unique Constraint Conflicts during Merge
-- This migration updates the merge functions to handle tmdb_id conflicts by:
-- 1. Accepting a metadata JSONB object for custom user selections.
-- 2. Clearing conflicting unique keys before updating the primary record.

-- Drop existing functions to allow for signature changes
DROP FUNCTION IF EXISTS public.merge_people(uuid, uuid);
DROP FUNCTION IF EXISTS public.merge_films(uuid, uuid);

-- 1. Robust Merge People Function with Metadata Support
CREATE OR REPLACE FUNCTION public.merge_people(
  p_primary_id uuid, 
  p_secondary_id uuid,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  v_tmdb_id INT;
BEGIN
    -- A. Prevent Unique Constraint Violation
    -- If we are assigning a tmdb_id that is currently held by the secondary person,
    -- we must clear it from the secondary person first.
    v_tmdb_id := (p_metadata->>'tmdb_id')::INT;
    IF v_tmdb_id IS NOT NULL THEN
        UPDATE public.people SET tmdb_id = NULL WHERE tmdb_id = v_tmdb_id;
    END IF;

    -- B. Handle Credits (Move from secondary to primary)
    DELETE FROM public.credits c_sec
    WHERE c_sec.person_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.credits c_pri 
        WHERE c_pri.person_id = p_primary_id 
        AND c_pri.film_id = c_sec.film_id 
        AND c_pri.role = c_sec.role
    );
    UPDATE public.credits SET person_id = p_primary_id WHERE person_id = p_secondary_id;

    -- C. Move Relations
    UPDATE public.profile_claims SET person_id = p_primary_id WHERE person_id = p_secondary_id;
    UPDATE public.channels SET owner_person_id = p_primary_id WHERE owner_person_id = p_secondary_id;
    UPDATE public.users SET linked_profile_id = p_primary_id WHERE linked_profile_id = p_secondary_id;

    -- D. Apply Enriched Metadata
    -- Apply selections from the UI. We use NULLIF to handle empty strings.
    UPDATE public.people
    SET 
        name = COALESCE(NULLIF(p_metadata->>'name', ''), name),
        bio = COALESCE(NULLIF(p_metadata->>'bio', ''), bio),
        photo_url = COALESCE(NULLIF(p_metadata->>'photo_url', ''), photo_url),
        nationality = COALESCE(NULLIF(p_metadata->>'nationality', ''), nationality),
        tmdb_id = v_tmdb_id,
        youtube_handle = COALESCE(NULLIF(p_metadata->>'youtube_handle', ''), youtube_handle),
        youtube_channel_id = COALESCE(NULLIF(p_metadata->>'youtube_channel_id', ''), youtube_channel_id),
        gender = COALESCE(NULLIF(p_metadata->>'gender', ''), gender)
    WHERE id = p_primary_id;

    -- E. Delete Secondary Profile
    DELETE FROM public.people WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Robust Merge Films Function with Metadata Support
CREATE OR REPLACE FUNCTION public.merge_films(
  p_primary_id uuid, 
  p_secondary_id uuid,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS void AS $$
DECLARE
  v_tmdb_id INT;
BEGIN
    -- A. Prevent Unique Constraint Violation
    v_tmdb_id := (p_metadata->>'tmdb_id')::INT;
    IF v_tmdb_id IS NOT NULL THEN
        UPDATE public.films SET tmdb_id = NULL WHERE tmdb_id = v_tmdb_id;
    END IF;

    -- B. Handle Credits (Move from secondary film to primary film)
    DELETE FROM public.credits c_sec
    WHERE c_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.credits c_pri 
        WHERE c_pri.film_id = p_primary_id 
        AND c_pri.person_id = c_sec.person_id 
        AND c_pri.role = c_sec.role
    );
    UPDATE public.credits SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- C. Apply Enriched Metadata
    UPDATE public.films
    SET 
        title = COALESCE(NULLIF(p_metadata->>'title', ''), title),
        synopsis = COALESCE(NULLIF(p_metadata->>'synopsis', ''), synopsis),
        poster_url = COALESCE(NULLIF(p_metadata->>'poster_url', ''), poster_url),
        year = COALESCE((p_metadata->>'year')::INT, year),
        runtime_minutes = COALESCE((p_metadata->>'runtime_minutes')::INT, runtime_minutes),
        tmdb_id = v_tmdb_id,
        status = COALESCE(NULLIF(p_metadata->>'status', ''), status),
        release_type = COALESCE(NULLIF(p_metadata->>'release_type', ''), release_type),
        rating = COALESCE(NULLIF(p_metadata->>'rating', ''), rating)
    WHERE id = p_primary_id;

    -- D. Delete Secondary Film
    DELETE FROM public.films WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
