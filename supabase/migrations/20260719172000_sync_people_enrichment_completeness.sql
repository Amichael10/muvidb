-- Keep queue progress accurate after approved enrichment and manual profile edits.

CREATE OR REPLACE FUNCTION public.sync_people_enrichment_completeness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.people_enrichment_queue
  SET
    missing_fields = array_remove(ARRAY[
      CASE WHEN NULLIF(trim(NEW.bio), '') IS NULL THEN 'bio' END,
      CASE WHEN NULLIF(trim(NEW.photo_url), '') IS NULL THEN 'photo_url' END,
      CASE WHEN NEW.date_of_birth IS NULL THEN 'date_of_birth' END,
      CASE WHEN NULLIF(trim(NEW.birthplace), '') IS NULL THEN 'birthplace' END,
      CASE WHEN NULLIF(trim(NEW.known_for_department), '') IS NULL THEN 'known_for_department' END,
      CASE WHEN NULLIF(trim(NEW.instagram_url), '') IS NULL THEN 'instagram_url' END,
      CASE WHEN NULLIF(trim(NEW.facebook_url), '') IS NULL THEN 'facebook_url' END,
      CASE WHEN NULLIF(trim(NEW.twitter_url), '') IS NULL THEN 'twitter_url' END,
      CASE WHEN NEW.tmdb_id IS NULL THEN 'tmdb_id' END
    ], NULL),
    current_completeness = (
      CASE WHEN NULLIF(trim(NEW.photo_url), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.bio), '') IS NOT NULL THEN 20 ELSE 0 END +
      CASE WHEN NEW.date_of_birth IS NOT NULL THEN 12 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.birthplace), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.known_for_department), '') IS NOT NULL THEN 8 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.instagram_url), '') IS NOT NULL THEN 10 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.facebook_url), '') IS NOT NULL THEN 5 ELSE 0 END +
      CASE WHEN NULLIF(trim(NEW.twitter_url), '') IS NOT NULL THEN 5 ELSE 0 END +
      CASE WHEN NEW.tmdb_id IS NOT NULL THEN 12 ELSE 0 END
    )::smallint
  WHERE person_id = NEW.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS people_enrichment_completeness_after_update ON public.people;
CREATE TRIGGER people_enrichment_completeness_after_update
  AFTER UPDATE OF
    bio, photo_url, date_of_birth, birthplace, known_for_department,
    instagram_url, facebook_url, twitter_url, tmdb_id
  ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_people_enrichment_completeness();
