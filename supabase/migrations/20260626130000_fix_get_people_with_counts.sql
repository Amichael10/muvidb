-- Migration: Fix get_people_with_counts return signature and type mismatch
-- Drop old function to allow different column layout/types in return table
DROP FUNCTION IF EXISTS public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text);

-- Recreate function with correct type casts and column structure
CREATE OR REPLACE FUNCTION public.get_people_with_counts(
  p_search TEXT DEFAULT '',
  p_verified TEXT DEFAULT 'all',
  p_spotlight TEXT DEFAULT 'all',
  p_sort_col TEXT DEFAULT 'popularity_score',
  p_sort_asc BOOLEAN DEFAULT FALSE,
  p_offset INT DEFAULT 0,
  p_limit INT DEFAULT 25,
  p_status TEXT DEFAULT 'all'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  photo_url TEXT,
  is_verified BOOLEAN,
  is_spotlight BOOLEAN,
  popularity_score FLOAT,
  known_for_department TEXT,
  traditional_credits_count BIGINT,
  youtube_filmography_count BIGINT,
  total_filmography_count BIGINT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.photo_url,
    p.is_verified,
    p.is_spotlight,
    p.popularity_score::FLOAT,
    p.known_for_department,
    (SELECT COUNT(*) FROM public.credits WHERE person_id = p.id)::BIGINT as traditional_credits_count,
    (
      SELECT COALESCE(COUNT(*), 0)
      FROM public.channel_videos cv
      JOIN public.channels ch ON ch.id = cv.channel_id
      WHERE ch.owner_person_id = p.id
      AND (
        (p.known_for_department = 'Actor' AND cv.duration_seconds >= 2100) OR -- 35 mins
        (p.known_for_department = 'Skit Maker' AND cv.duration_seconds >= 900) OR -- 15 mins
        (p.known_for_department NOT IN ('Actor', 'Skit Maker') AND cv.duration_seconds >= 900) -- Default to 15 mins
      )
    )::BIGINT as youtube_filmography_count,
    (
      (SELECT COUNT(*) FROM public.credits WHERE person_id = p.id) +
      (
        SELECT COALESCE(COUNT(*), 0)
        FROM public.channel_videos cv
        JOIN public.channels ch ON ch.id = cv.channel_id
        WHERE ch.owner_person_id = p.id
        AND (
          (p.known_for_department = 'Actor' AND cv.duration_seconds >= 2100) OR -- 35 mins
          (p.known_for_department = 'Skit Maker' AND cv.duration_seconds >= 900) OR -- 15 mins
          (p.known_for_department NOT IN ('Actor', 'Skit Maker') AND cv.duration_seconds >= 900)
        )
      )
    )::BIGINT as total_filmography_count,
    p.created_at
  FROM public.people p
  WHERE (p_search = '' OR p.name ILIKE '%' || p_search || '%')
    AND (p_verified = 'all' OR p.is_verified = (p_verified = 'verified'))
    AND (p_spotlight = 'all' OR p.is_spotlight = (p_spotlight = 'spotlight'))
    AND (p_status = 'all' OR (
        (p_status = 'incomplete' AND (p.bio IS NULL OR p.photo_url IS NULL OR p.bio = '' OR p.photo_url = '')) OR
        (p_status = 'complete' AND (p.bio IS NOT NULL AND p.photo_url IS NOT NULL AND p.bio != '' AND p.photo_url != ''))
    ))
  ORDER BY 
    CASE WHEN p_sort_col = 'popularity_score' AND p_sort_asc = FALSE THEN p.popularity_score END DESC,
    CASE WHEN p_sort_col = 'popularity_score' AND p_sort_asc = TRUE THEN p.popularity_score END ASC,
    CASE WHEN p_sort_col = 'name' AND p_sort_asc = FALSE THEN p.name END DESC,
    CASE WHEN p_sort_col = 'name' AND p_sort_asc = TRUE THEN p.name END ASC,
    CASE WHEN p_sort_col = 'created_at' AND p_sort_asc = FALSE THEN p.created_at END DESC,
    CASE WHEN p_sort_col = 'created_at' AND p_sort_asc = TRUE THEN p.created_at END ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Set correct permissions
REVOKE EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) TO authenticated;
