-- Redefine refresh_all_popularity_scores to bypass pg_safeupdate
CREATE OR REPLACE FUNCTION public.refresh_all_popularity_scores()
RETURNS void AS $$
BEGIN
  UPDATE public.people p
  SET popularity_score = (
    SELECT COUNT(*) 
    FROM public.credits c 
    WHERE c.person_id = p.id
  )
  WHERE true; -- Required to bypass safe update checks
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
