-- FINAL STABILIZATION SCRIPT v2
-- RUN THIS IN SUPABASE SQL EDITOR

-- 1. Ensure Columns Exist
ALTER TABLE channels ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT FALSE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS owner_company_id UUID REFERENCES companies(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Cleanup Old Functions to avoid "cannot change return type" errors
DROP FUNCTION IF EXISTS get_people_with_counts(TEXT, TEXT, TEXT, TEXT, BOOLEAN, INT, INT);
DROP FUNCTION IF EXISTS get_people_with_counts(TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_people_with_counts(TEXT, TEXT, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_people_with_counts(text, text, text, text, boolean, integer, integer);

-- 3. Core People Function (Matches AdminPeople.jsx)
CREATE OR REPLACE FUNCTION get_people_with_counts(
  p_search TEXT DEFAULT '',
  p_verified TEXT DEFAULT 'all',
  p_spotlight TEXT DEFAULT 'all',
  p_sort_col TEXT DEFAULT 'popularity_score',
  p_sort_asc BOOLEAN DEFAULT FALSE,
  p_limit INT DEFAULT 25,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  photo_url TEXT,
  known_for_department TEXT,
  popularity_score FLOAT,
  is_verified BOOLEAN,
  is_spotlight BOOLEAN,
  created_at TIMESTAMPTZ,
  total_filmography_count BIGINT,
  traditional_credits_count BIGINT,
  youtube_filmography_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH person_counts AS (
    SELECT 
      c.person_id,
      COUNT(*) as total_count,
      COUNT(*) FILTER (WHERE f.youtube_watch_url IS NULL) as traditional_count,
      COUNT(*) FILTER (WHERE f.youtube_watch_url IS NOT NULL) as youtube_count
    FROM credits c
    JOIN films f ON c.film_id = f.id
    GROUP BY c.person_id
  )
  SELECT 
    p.id,
    p.name,
    p.photo_url,
    p.known_for_department,
    p.popularity_score,
    p.is_verified,
    p.is_spotlight,
    p.created_at,
    COALESCE(pc.total_count, 0)::BIGINT as total_filmography_count,
    COALESCE(pc.traditional_count, 0)::BIGINT as traditional_credits_count,
    COALESCE(pc.youtube_count, 0)::BIGINT as youtube_filmography_count
  FROM people p
  LEFT JOIN person_counts pc ON p.id = pc.person_id
  WHERE (p_search = '' OR p.name ILIKE '%' || p_search || '%')
    AND (p_verified = 'all' OR p.is_verified = (p_verified = 'verified'))
    AND (p_spotlight = 'all' OR p.is_spotlight = (p_spotlight = 'spotlight'))
  ORDER BY 
    CASE WHEN NOT p_sort_asc THEN
      CASE 
        WHEN p_sort_col = 'popularity_score' THEN p.popularity_score
        WHEN p_sort_col = 'created_at' THEN EXTRACT(EPOCH FROM p.created_at)
        ELSE p.popularity_score
      END
    END DESC,
    CASE WHEN p_sort_asc THEN
      CASE 
        WHEN p_sort_col = 'popularity_score' THEN p.popularity_score
        WHEN p_sort_col = 'created_at' THEN EXTRACT(EPOCH FROM p.created_at)
        ELSE p.popularity_score
      END
    END ASC,
    CASE WHEN p_sort_col = 'name' AND NOT p_sort_asc THEN p.name END DESC,
    CASE WHEN p_sort_col = 'name' AND p_sort_asc THEN p.name END ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- 4. Admin Utility Functions
CREATE OR REPLACE FUNCTION admin_change_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET role = new_role WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_ban_user(target_user_id UUID, ban_status BOOLEAN)
RETURNS VOID AS $$
BEGIN
  UPDATE users SET is_banned = ban_status WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  DELETE FROM users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION refresh_all_popularity_scores()
RETURNS VOID AS $$
BEGIN
  UPDATE people p
  SET popularity_score = (
    SELECT COUNT(*) 
    FROM credits c 
    WHERE c.person_id = p.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
