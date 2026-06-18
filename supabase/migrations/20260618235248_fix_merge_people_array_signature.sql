-- Fix the broken array signature of merge_people that references the non-existent film_producers table
CREATE OR REPLACE FUNCTION public.merge_people(p_master_id uuid, p_duplicate_ids uuid[])
RETURNS void AS $$
DECLARE
  dup_id uuid;
BEGIN
  -- Loop through each duplicate and delegate to the robust 3-argument merge_people function
  -- We pass an empty jsonb object for the metadata to satisfy the signature
  FOREACH dup_id IN ARRAY p_duplicate_ids
  LOOP
    PERFORM public.merge_people(p_master_id, dup_id, '{}'::jsonb);
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
