-- UNIFIED PEOPLE RPC FIX
-- This script replaces all previous versions of get_people_with_counts

-- 1. Drop ALL potentially conflicting signatures
DROP FUNCTION IF EXISTS get_people_with_counts(TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_people_with_counts(TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER, TEXT);

-- 2. Create the latest version with 8 parameters
CREATE OR REPLACE FUNCTION get_people_with_counts(
  p_search TEXT DEFAULT '',
  p_verified TEXT DEFAULT 'all',
  p_spotlight TEXT DEFAULT 'all',
  p_sort_col TEXT DEFAULT 'popularity_score',
  p_sort_asc BOOLEAN DEFAULT false,
  p_offset INTEGER DEFAULT 0,
  p_limit INTEGER DEFAULT 25,
  p_status TEXT DEFAULT 'all'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  photo_url TEXT,
  known_for_department TEXT,
  is_verified BOOLEAN,
  is_spotlight BOOLEAN,
  popularity_score FLOAT,
  created_at TIMESTAMPTZ,
  total_filmography_count BIGINT,
  traditional_credits_count BIGINT,
  youtube_filmography_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.photo_url,
    p.known_for_department,
    p.is_verified,
    p.is_spotlight,
    p.popularity_score::FLOAT,
    p.created_at,
    (SELECT COUNT(*) FROM credits c WHERE c.person_id = p.id)::BIGINT as total_filmography_count,
    (SELECT COUNT(*) FROM credits c JOIN films f ON c.film_id = f.id WHERE c.person_id = p.id AND f.youtube_watch_url IS NULL)::BIGINT as traditional_credits_count,
    (SELECT COUNT(*) FROM credits c JOIN films f ON c.film_id = f.id WHERE c.person_id = p.id AND f.youtube_watch_url IS NOT NULL)::BIGINT as youtube_filmography_count
  FROM people p
  WHERE (p_search = '' OR p.name ILIKE '%' || p_search || '%')
    AND (p_verified = 'all' OR p.is_verified = (p_verified = 'verified'))
    AND (p_spotlight = 'all' OR p.is_spotlight = (p_spotlight = 'spotlight'))
    AND (p_status = 'all' 
         OR (p_status = 'incomplete' AND (p.bio IS NULL OR p.photo_url IS NULL OR p.bio = '' OR p.photo_url = ''))
         OR (p_status = 'complete' AND (p.bio IS NOT NULL AND p.photo_url IS NOT NULL AND p.bio != '' AND p.photo_url != ''))
    )
  ORDER BY 
    -- Handling mixed-type sorting using explicit casts
    CASE WHEN NOT p_sort_asc THEN
      CASE 
        WHEN p_sort_col = 'popularity_score' THEN p.popularity_score::float8
        WHEN p_sort_col = 'created_at' THEN EXTRACT(EPOCH FROM p.created_at)::float8
        ELSE NULL 
      END
    END DESC,
    CASE WHEN p_sort_asc THEN
      CASE 
        WHEN p_sort_col = 'popularity_score' THEN p.popularity_score::float8
        WHEN p_sort_col = 'created_at' THEN EXTRACT(EPOCH FROM p.created_at)::float8
        ELSE NULL 
      END
    END ASC,
    -- String sort as secondary
    CASE WHEN p_sort_col = 'name' AND NOT p_sort_asc THEN p.name END DESC,
    CASE WHEN p_sort_col = 'name' AND p_sort_asc THEN p.name END ASC,
    -- Tie-breaker
    p.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
