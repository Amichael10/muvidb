-- Final Merge Integrity Fix
-- This script replaces the existing merge_people and merge_films functions with robust versions.
-- Note: We must DROP the functions first because we changed parameter names from 'primary_id' to 'p_primary_id'.

-- Drop existing functions to allow for parameter name changes
DROP FUNCTION IF EXISTS public.merge_people(uuid, uuid);
DROP FUNCTION IF EXISTS public.merge_films(uuid, uuid);

-- 1. Robust Merge People Function
CREATE OR REPLACE FUNCTION public.merge_people(p_primary_id uuid, p_secondary_id uuid)
RETURNS void AS $$
BEGIN
    -- A. Handle Credits (Move from secondary to primary)
    -- First, delete credits on the secondary profile that would cause duplicate conflicts on the primary profile.
    DELETE FROM public.credits c_sec
    WHERE c_sec.person_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.credits c_pri 
        WHERE c_pri.person_id = p_primary_id 
        AND c_pri.film_id = c_sec.film_id 
        AND c_pri.role = c_sec.role
    );

    -- Now update all remaining non-conflicting credits to point to the primary profile.
    UPDATE public.credits 
    SET person_id = p_primary_id 
    WHERE person_id = p_secondary_id;

    -- B. Move Profile Claims
    UPDATE public.profile_claims
    SET person_id = p_primary_id
    WHERE person_id = p_secondary_id;

    -- C. Move YouTube Channels
    UPDATE public.channels 
    SET owner_person_id = p_primary_id 
    WHERE owner_person_id = p_secondary_id;

    -- D. Update Linked Users
    UPDATE public.users 
    SET linked_profile_id = p_primary_id 
    WHERE linked_profile_id = p_secondary_id;

    -- E. Enrich Primary Data from Secondary
    UPDATE public.people p
    SET 
        bio = COALESCE(NULLIF(TRIM(p.bio), ''), s.bio),
        photo_url = COALESCE(p.photo_url, s.photo_url),
        date_of_birth = COALESCE(p.date_of_birth, s.date_of_birth),
        tmdb_id = COALESCE(p.tmdb_id, s.tmdb_id),
        nationality = COALESCE(p.nationality, s.nationality),
        youtube_channel_id = COALESCE(p.youtube_channel_id, s.youtube_channel_id),
        popularity_score = GREATEST(COALESCE(p.popularity_score, 0), COALESCE(s.popularity_score, 0)),
        gender = COALESCE(p.gender, s.gender),
        youtube_handle = COALESCE(p.youtube_handle, s.youtube_handle),
        is_verified = p.is_verified OR s.is_verified,
        is_spotlight = p.is_spotlight OR s.is_spotlight
    FROM public.people s
    WHERE p.id = p_primary_id AND s.id = p_secondary_id;

    -- F. Delete Secondary Profile
    DELETE FROM public.people WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Robust Merge Films Function
CREATE OR REPLACE FUNCTION public.merge_films(p_primary_id uuid, p_secondary_id uuid)
RETURNS void AS $$
BEGIN
    -- A. Handle Credits (Move from secondary film to primary film)
    DELETE FROM public.credits c_sec
    WHERE c_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.credits c_pri 
        WHERE c_pri.film_id = p_primary_id 
        AND c_pri.person_id = c_sec.person_id 
        AND c_pri.role = c_sec.role
    );

    -- Update remaining credits to point to the primary film
    UPDATE public.credits 
    SET film_id = p_primary_id 
    WHERE film_id = p_secondary_id;

    -- B. Enrich Primary Film Data from Secondary
    UPDATE public.films p
    SET 
        synopsis = COALESCE(NULLIF(TRIM(p.synopsis), ''), s.synopsis),
        poster_url = COALESCE(p.poster_url, s.poster_url),
        year = COALESCE(p.year, s.year),
        runtime_minutes = COALESCE(p.runtime_minutes, s.runtime_minutes),
        tmdb_id = COALESCE(p.tmdb_id, s.tmdb_id),
        trailer_url = COALESCE(p.trailer_url, s.trailer_url),
        backdrop_url = COALESCE(p.backdrop_url, s.backdrop_url),
        status = COALESCE(p.status, s.status),
        release_type = COALESCE(p.release_type, s.release_type),
        rating = COALESCE(p.rating, s.rating)
    FROM public.films s
    WHERE p.id = p_primary_id AND s.id = p_secondary_id;

    -- C. Delete Secondary Film
    DELETE FROM public.films WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
