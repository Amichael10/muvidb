-- Return the small, public-safe shape needed by the homepage Coming Soon rail.
-- Keeping the genre aggregation inside SQL avoids a wide PostgREST embed over films.
CREATE OR REPLACE FUNCTION public.get_coming_soon_films(p_limit integer DEFAULT 20)
RETURNS SETOF jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', f.id,
    'slug', f.slug,
    'title', f.title,
    'poster_url', f.poster_url,
    'backdrop_url', f.backdrop_url,
    'year', f.year,
    'language', f.language,
    'synopsis', f.synopsis,
    'runtime_minutes', f.runtime_minutes,
    'view_count', f.view_count,
    'average_rating', f.average_rating,
    'nfvcb_rating', f.nfvcb_rating,
    'is_featured', f.is_featured,
    'is_trending', f.is_trending,
    'release_type', f.release_type,
    'streaming_links', f.streaming_links,
    'source', f.source,
    'is_in_cinemas', f.is_in_cinemas,
    'created_at', f.created_at,
    'release_date', f.release_date,
    'youtube_watch_url', f.youtube_watch_url,
    'genres', COALESCE(
      (
        SELECT jsonb_agg(g.name ORDER BY g.name)
        FROM public.film_genres fg
        JOIN public.genres g ON g.id = fg.genre_id
        WHERE fg.film_id = f.id
      ),
      '[]'::jsonb
    )
  )
  FROM public.films f
  WHERE f.status IN ('upcoming', 'announced', 'in_production', 'filming', 'post-production')
  ORDER BY f.release_date ASC NULLS LAST, f.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
$$;

REVOKE ALL ON FUNCTION public.get_coming_soon_films(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_coming_soon_films(integer) TO anon, authenticated;
