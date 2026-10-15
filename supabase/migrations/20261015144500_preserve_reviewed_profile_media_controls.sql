-- Existing public items may be removed/reordered or selected as primary.
-- Adding/changing their content still requires the moderation API.
CREATE OR REPLACE FUNCTION public.profile_media_highlights_retained(p_new jsonb, p_old jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $function$
  SELECT CASE WHEN p_new IS NOT DISTINCT FROM p_old OR p_new IS NULL OR p_new = 'null'::jsonb THEN true
    WHEN jsonb_typeof(p_new) <> 'array' THEN false
    WHEN p_old IS NULL OR jsonb_typeof(p_old) <> 'array' THEN p_new = '[]'::jsonb
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_new) item
      WHERE jsonb_typeof(item) <> 'object'
        OR (item ? 'is_primary' AND jsonb_typeof(item->'is_primary') <> 'boolean')
        OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_old) previous
          WHERE (previous - 'is_primary') = (item - 'is_primary'))
    ) END;
$function$;
REVOKE ALL ON FUNCTION public.profile_media_highlights_retained(jsonb,jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.require_review_for_profile_media()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE field_name text; new_url text;
BEGIN
  IF auth.role() = 'service_role' OR public.is_admin()
    OR (auth.role() IS NULL AND session_user IN ('postgres', 'supabase_admin')) THEN RETURN NEW; END IF;
  FOREACH field_name IN ARRAY ARRAY['photo_url','backdrop_url','banner_url','cover_url'] LOOP
    IF to_jsonb(NEW)->field_name IS DISTINCT FROM to_jsonb(OLD)->field_name THEN
      new_url := to_jsonb(NEW)->>field_name;
      IF new_url IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.person_media WHERE person_id = NEW.id
          AND status = 'approved' AND media_type = 'photo' AND url = new_url
      ) AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(OLD.youtube_stats->'instagram_highlights') = 'array'
          THEN OLD.youtube_stats->'instagram_highlights' ELSE '[]'::jsonb END) item
        WHERE item->>'type' = 'photo' AND item->>'url' = new_url
      ) THEN RAISE EXCEPTION 'Submit portfolio media for administrator review' USING ERRCODE = '42501'; END IF;
    END IF;
  END LOOP;
  IF NOT public.profile_media_highlights_retained(to_jsonb(NEW)->'instagram_highlights', to_jsonb(OLD)->'instagram_highlights')
    OR NOT public.profile_media_highlights_retained(NEW.youtube_stats->'instagram_highlights', OLD.youtube_stats->'instagram_highlights') THEN
    RAISE EXCEPTION 'Submit portfolio media for administrator review' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.require_review_for_profile_media() FROM PUBLIC, anon, authenticated;
