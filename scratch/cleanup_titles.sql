-- Instant Cleanup for common YouTube noise
UPDATE films
SET title = REGEXP_REPLACE(title, '\s*[\(\[].*?[\)\]]', '', 'g')
WHERE title ~ '[\(\[].*?[\)\]]';

UPDATE films
SET title = REGEXP_REPLACE(title, '\s*\|\s*.*$', '', 'g')
WHERE title LIKE '%|%';

UPDATE films
SET title = TRIM(REGEXP_REPLACE(title, '\s*(202[345]|LATEST|NIGERIAN|YORUBA|MOVIE|FULL|PART\s*\d+).*$', '', 'gi'))
WHERE title ~* '(202[345]|LATEST|NIGERIAN|YORUBA|MOVIE|FULL|PART)';

-- Fix Merge Function
CREATE OR REPLACE FUNCTION merge_people(p_master_id UUID, p_duplicate_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE credits SET person_id = p_master_id WHERE person_id = ANY(p_duplicate_ids);
  UPDATE film_producers SET person_id = p_master_id WHERE person_id = ANY(p_duplicate_ids);
  DELETE FROM people WHERE id = ANY(p_duplicate_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
