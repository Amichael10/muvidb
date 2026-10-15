CREATE OR REPLACE FUNCTION public.require_review_for_profile_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE field_name text;
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN RETURN NEW; END IF;
  FOREACH field_name IN ARRAY ARRAY['photo_url','backdrop_url','banner_url','cover_url','instagram_highlights'] LOOP
    IF to_jsonb(NEW)->field_name IS DISTINCT FROM to_jsonb(OLD)->field_name THEN
      RAISE EXCEPTION 'Submit portfolio media for administrator review' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF NEW.youtube_stats->'instagram_highlights' IS DISTINCT FROM OLD.youtube_stats->'instagram_highlights' THEN
    RAISE EXCEPTION 'Submit portfolio media for administrator review' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.require_review_for_profile_media() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS require_review_for_profile_media ON public.people;
CREATE TRIGGER require_review_for_profile_media BEFORE UPDATE ON public.people
  FOR EACH ROW EXECUTE FUNCTION public.require_review_for_profile_media();
