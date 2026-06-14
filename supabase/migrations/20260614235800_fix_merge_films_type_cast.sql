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

    -- Update watch destinations (Move from secondary film to primary film)
    DELETE FROM public.watch_destinations w_sec
    WHERE w_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.watch_destinations w_pri 
        WHERE w_pri.film_id = p_primary_id 
        AND w_pri.platform = w_sec.platform
    );
    UPDATE public.watch_destinations SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Update film_countries (Move from secondary to primary)
    DELETE FROM public.film_countries fc_sec
    WHERE fc_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.film_countries fc_pri 
        WHERE fc_pri.film_id = p_primary_id 
        AND fc_pri.country_code = fc_sec.country_code
    );
    UPDATE public.film_countries SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Update videos (Move from secondary to primary)
    UPDATE public.videos SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Update mubi_urls (Move from secondary to primary)
    UPDATE public.mubi_urls SET film_id = p_primary_id WHERE film_id = p_secondary_id;

    -- Update waitlist (Move from secondary to primary)
    DELETE FROM public.waitlist w_sec
    WHERE w_sec.film_id = p_secondary_id
    AND EXISTS (
        SELECT 1 FROM public.waitlist w_pri 
        WHERE w_pri.film_id = p_primary_id 
        AND w_pri.email = w_sec.email
    );
    UPDATE public.waitlist SET film_id = p_primary_id WHERE film_id = p_secondary_id;

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
        rating = COALESCE(NULLIF(p_metadata->>'rating', ''), rating),
        youtube_watch_url = COALESCE(NULLIF(p_metadata->>'youtube_watch_url', ''), youtube_watch_url)
    WHERE id = p_primary_id;

    -- D. Delete Secondary Film
    DELETE FROM public.films WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
