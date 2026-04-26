-- 1. Drop existing function to change parameter names, then recreate
DROP FUNCTION IF EXISTS merge_people(uuid, uuid);

CREATE OR REPLACE FUNCTION merge_people(p_primary_id UUID, p_secondary_id UUID)
RETURNS void AS $$
BEGIN
  -- A) Move credits: update person_id. Handle unique constraint by ignoring duplicates.
  UPDATE credits c1
  SET person_id = p_primary_id 
  WHERE person_id = p_secondary_id
  AND NOT EXISTS (
    SELECT 1 FROM credits c2 
    WHERE c2.person_id = p_primary_id 
    AND c2.film_id = c1.film_id 
    AND c2.role = c1.role
  );
  
  -- Delete any remaining credits for p_secondary_id (duplicates)
  DELETE FROM credits WHERE person_id = p_secondary_id;

  -- B) Move channels
  UPDATE channels SET owner_person_id = p_primary_id WHERE owner_person_id = p_secondary_id;

  -- C) Move users (linked profiles)
  UPDATE users SET linked_profile_id = p_primary_id WHERE linked_profile_id = p_secondary_id;

  -- D) Finally delete the secondary person
  DELETE FROM people WHERE id = p_secondary_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Force PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
