import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)

const sql = `
CREATE OR REPLACE FUNCTION get_people_with_counts(
  p_search TEXT DEFAULT '',
  p_verified TEXT DEFAULT 'all',
  p_spotlight TEXT DEFAULT 'all',
  p_sort_col TEXT DEFAULT 'popularity_score',
  p_sort_asc BOOLEAN DEFAULT FALSE,
  p_offset INT DEFAULT 0,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  photo_url TEXT,
  is_verified BOOLEAN,
  is_spotlight BOOLEAN,
  popularity_score FLOAT,
  primary_role TEXT,
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
    p.popularity_score,
    p.primary_role,
    (SELECT COUNT(*) FROM credits WHERE person_id = p.id) as traditional_credits_count,
    (
      SELECT COALESCE(COUNT(*), 0)
      FROM channel_videos cv
      JOIN channels ch ON ch.id = cv.channel_id
      WHERE ch.owner_person_id = p.id
      AND (
        (p.primary_role = 'Actor' AND cv.duration_seconds >= 2100) OR -- 35 mins
        (p.primary_role = 'Skit Maker' AND cv.duration_seconds >= 900) OR -- 15 mins
        (p.primary_role NOT IN ('Actor', 'Skit Maker') AND cv.duration_seconds >= 900) -- Default to 15 mins
      )
    ) as youtube_filmography_count,
    (
      (SELECT COUNT(*) FROM credits WHERE person_id = p.id) +
      (
        SELECT COALESCE(COUNT(*), 0)
        FROM channel_videos cv
        JOIN channels ch ON ch.id = cv.channel_id
        WHERE ch.owner_person_id = p.id
        AND (
          (p.primary_role = 'Actor' AND cv.duration_seconds >= 2100) OR -- 35 mins
          (p.primary_role = 'Skit Maker' AND cv.duration_seconds >= 900) OR -- 15 mins
          (p.primary_role NOT IN ('Actor', 'Skit Maker') AND cv.duration_seconds >= 900)
        )
      )
    ) as total_filmography_count,
    p.created_at
  FROM people p
  WHERE (p_search = '' OR p.name ILIKE '%' || p_search || '%')
    AND (p_verified = 'all' OR p.is_verified = (p_verified = 'verified'))
    AND (p_spotlight = 'all' OR p.is_spotlight = (p_spotlight = 'spotlight'))
  ORDER BY 
    CASE WHEN p_sort_col = 'popularity_score' AND p_sort_asc = FALSE THEN p.popularity_score END DESC,
    CASE WHEN p_sort_col = 'popularity_score' AND p_sort_asc = TRUE THEN p.popularity_score END ASC,
    CASE WHEN p_sort_col = 'name' AND p_sort_asc = FALSE THEN p.name END DESC,
    CASE WHEN p_sort_col = 'name' AND p_sort_asc = TRUE THEN p.name END ASC,
    CASE WHEN p_sort_col = 'created_at' AND p_sort_asc = FALSE THEN p.created_at END DESC,
    CASE WHEN p_sort_col = 'created_at' AND p_sort_asc = TRUE THEN p.created_at END ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;
`;

async function update() {
  // We use postgREST's ability to run raw SQL if available, but usually we can't from client.
  // Actually, I can't run raw SQL via supabase client unless there is an extension or I use psql.
  // I'll try to find if there is a 'sql' rpc or similar.
  console.log("Please run this SQL in the Supabase Dashboard SQL Editor.");
  console.log(sql);
}

update()
