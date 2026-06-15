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
    v_tmdb_id := (NULLIF(p_metadata->>'tmdb_id', ''))::INT;
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

    -- Transfer film_companies
    DELETE FROM public.film_companies c_sec
    WHERE c_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.film_companies c_pri 
        WHERE c_pri.film_id = p_primary_id 
        AND c_pri.company_id = c_sec.company_id
        AND c_pri.role = c_sec.role
    );
    UPDATE public.film_companies SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Transfer collection_films
    DELETE FROM public.collection_films cf_sec
    WHERE cf_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.collection_films cf_pri 
        WHERE cf_pri.film_id = p_primary_id 
        AND cf_pri.collection_id = cf_sec.collection_id
    );
    UPDATE public.collection_films SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Transfer watchlist
    DELETE FROM public.watchlist w_sec
    WHERE w_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.watchlist w_pri 
        WHERE w_pri.film_id = p_primary_id 
        AND w_pri.user_id = w_sec.user_id
    );
    UPDATE public.watchlist SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Transfer reviews
    DELETE FROM public.reviews r_sec
    WHERE r_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.reviews r_pri 
        WHERE r_pri.film_id = p_primary_id 
        AND r_pri.user_id = r_sec.user_id
    );
    UPDATE public.reviews SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Transfer pending_cinema_films
    UPDATE public.pending_cinema_films SET promoted_film_id = p_primary_id WHERE promoted_film_id = p_secondary_id;

    -- C. Apply Enriched Metadata
    UPDATE public.films
    SET 
        title = COALESCE(NULLIF(p_metadata->>'title', ''), title),
        synopsis = COALESCE(NULLIF(p_metadata->>'synopsis', ''), synopsis),
        poster_url = COALESCE(NULLIF(p_metadata->>'poster_url', ''), poster_url),
        year = COALESCE((NULLIF(p_metadata->>'year', ''))::INT, year),
        runtime_minutes = COALESCE((NULLIF(p_metadata->>'runtime_minutes', ''))::INT, runtime_minutes),
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
