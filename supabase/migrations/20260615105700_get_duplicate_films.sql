-- Migration: get_duplicate_films RPC
-- Description: Get a list of films that share the same title

CREATE OR REPLACE FUNCTION get_duplicate_films()
RETURNS SETOF films AS $$
BEGIN
  RETURN QUERY
  SELECT f.*
  FROM films f
  JOIN (
    SELECT lower(trim(title)) as norm_title
    FROM films
    GROUP BY lower(trim(title))
    HAVING count(id) > 1
  ) dups ON lower(trim(f.title)) = dups.norm_title
  ORDER BY lower(trim(f.title)), f.created_at DESC;
END;
$$ LANGUAGE plpgsql;
