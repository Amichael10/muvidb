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

    -- Transfer watch links
    DELETE FROM public.film_watch_links wl_sec
    WHERE wl_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.film_watch_links wl_pri 
        WHERE wl_pri.film_id = p_primary_id 
        AND wl_pri.distributor = wl_sec.distributor
    );
    UPDATE public.film_watch_links SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Transfer countries
    DELETE FROM public.film_countries fc_sec
    WHERE fc_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.film_countries fc_pri 
        WHERE fc_pri.film_id = p_primary_id 
        AND fc_pri.country_id = fc_sec.country_id
    );
    UPDATE public.film_countries SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Transfer genres
    DELETE FROM public.film_genres fg_sec
    WHERE fg_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.film_genres fg_pri 
        WHERE fg_pri.film_id = p_primary_id 
        AND fg_pri.genre_id = fg_sec.genre_id
    );
    UPDATE public.film_genres SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- C. Apply Enriched Metadata
    UPDATE public.films
    SET 
        title = COALESCE(NULLIF(p_metadata->>'title', ''), title),
        synopsis = COALESCE(NULLIF(p_metadata->>'synopsis', ''), synopsis),
        poster_url = COALESCE(NULLIF(p_metadata->>'poster_url', ''), poster_url),
        year = COALESCE((p_metadata->>'year')::INT, year),
        runtime_minutes = COALESCE((p_metadata->>'runtime_minutes')::INT, runtime_minutes),
        tmdb_id = v_tmdb_id,
        status = COALESCE((NULLIF(p_metadata->>'status', ''))::film_status, status),
        release_type = COALESCE(NULLIF(p_metadata->>'release_type', ''), release_type),
        nfvcb_rating = COALESCE((NULLIF(p_metadata->>'rating', ''))::nfvcb_rating, nfvcb_rating),
        youtube_watch_url = COALESCE(NULLIF(p_metadata->>'youtube_watch_url', ''), youtube_watch_url),
        language = COALESCE(NULLIF(p_metadata->>'language', ''), language)
    WHERE id = p_primary_id;

    -- D. Delete Secondary Film
    DELETE FROM public.films WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
