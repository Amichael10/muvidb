-- Restrict privileged account and catalogue operations to trusted callers.
CREATE OR REPLACE FUNCTION public.require_security_admin(p_catalog boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $guard$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN; END IF;
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid()
      AND (role::text = 'admin' OR (p_catalog AND role::text = 'admin_limited'))
  ) THEN RETURN; END IF;
  RAISE EXCEPTION 'Administrator authentication required' USING ERRCODE = '42501';
END;
$guard$;
REVOKE ALL ON FUNCTION public.require_security_admin(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_security_admin(boolean) TO authenticated, service_role;
DROP FUNCTION IF EXISTS public.force_promote_to_admin(text);

CREATE OR REPLACE FUNCTION public.handle_user_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    -- Get name with fallbacks
    v_name := COALESCE(
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1),
      'User'
    );

    -- Normalize role to valid enum values
    v_role := CASE


      WHEN (new.raw_user_meta_data->>'role') IN ('professional', 'pro', 'industry') THEN 'professional'
      ELSE 'fan'
    END;

    BEGIN
      INSERT INTO public.users (id, email, name, avatar_url, role, last_sign_in_at)
      VALUES (
        new.id,
        new.email,
        v_name,
        COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
        v_role::public.user_role,
        new.last_sign_in_at
      )
      ON CONFLICT (email) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, public.users.name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url),
        last_sign_in_at = EXCLUDED.last_sign_in_at;
    EXCEPTION WHEN OTHERS THEN
      -- Log to sync_logs gracefully to prevent blocking signup
      INSERT INTO public.sync_logs (source, status, message, details)
      VALUES (
        'handle_user_sync_trigger_insert',
        'error',
        SQLERRM,
        jsonb_build_object(
          'user_id', new.id,
          'email', new.email,
          'metadata', new.raw_user_meta_data,
          'sqlstate', SQLSTATE
        )
      );
    END;

  ELSIF (TG_OP = 'UPDATE') THEN
    BEGIN
      UPDATE public.users
      SET
        last_sign_in_at = new.last_sign_in_at,
        email = new.email,
        name = COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', public.users.name),
        avatar_url = COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture', public.users.avatar_url)
      WHERE id = new.id;
    EXCEPTION WHEN OTHERS THEN
      -- Log to sync_logs gracefully
      INSERT INTO public.sync_logs (source, status, message, details)
      VALUES (
        'handle_user_sync_trigger_update',
        'error',
        SQLERRM,
        jsonb_build_object(
          'user_id', new.id,
          'email', new.email,
          'metadata', new.raw_user_meta_data,
          'sqlstate', SQLSTATE
        )
      );
    END;
  END IF;
  RETURN new;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_change_role(target_user_id uuid, new_role text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_normalized_role TEXT;
BEGIN
    -- Security Check: Ensure caller is an admin
    IF auth.role() IS DISTINCT FROM 'service_role' AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'admin') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Normalize role values to valid enum members
    v_normalized_role := CASE new_role
      WHEN 'admin'          THEN 'admin'
      WHEN 'admin_limited'  THEN 'admin_limited'
      WHEN 'professional'   THEN 'professional'
      WHEN 'pro'            THEN 'professional'
      WHEN 'fan'            THEN 'fan'
      WHEN 'user'           THEN 'fan'
      ELSE new_role -- Allow direct enum values if they match
    END;

    -- 1. Update public.users table (cast TEXT -> user_role enum explicitly)
    UPDATE public.users
    SET role = v_normalized_role::user_role
    WHERE id = target_user_id;

    -- 2. Update auth.users raw_app_meta_data for RLS constraints & JWT claims
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb),
      '{role}',
      to_jsonb(v_normalized_role)
    )
    WHERE id = target_user_id;
END;
$function$;
REVOKE ALL ON FUNCTION admin_change_role(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_change_role(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.approve_company_claim(p_claim_id uuid, p_reviewer_id uuid DEFAULT auth.uid())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_claim RECORD;
  v_company RECORD;
BEGIN
  PERFORM public.require_security_admin(false);
  -- 1. Fetch claim
  SELECT * INTO v_claim FROM public.company_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company claim % not found', p_claim_id;
  END IF;

  IF v_claim.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Claim is already approved');
  END IF;

  -- 2. Fetch company
  SELECT * INTO v_company FROM public.companies WHERE id = v_claim.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated company % not found', v_claim.company_id;
  END IF;

  -- 3. Update claim status
  UPDATE public.company_claims
  SET status = 'approved',
      reviewed_by = CASE WHEN auth.role() = 'service_role' THEN p_reviewer_id ELSE auth.uid() END,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_claim_id;

  -- 4. Mark company as claimed & verified
  UPDATE public.companies
  SET claimed = true,
      verified = true,
      claimed_by = v_claim.user_id,
      claimed_at = NOW(),
      contact_email = COALESCE(contact_email, v_claim.work_email),
      api_tier = 'pro',
      updated_at = NOW()
  WHERE id = v_claim.company_id;

  -- 5. Add user as 'owner' in company_members
  INSERT INTO public.company_members (company_id, user_id, role, title, status)
  VALUES (v_claim.company_id, v_claim.user_id, 'owner', v_claim.official_role, 'active')
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET
    role = 'owner',
    title = EXCLUDED.title,
    status = 'active',
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_claim.company_id,
    'company_name', v_company.name,
    'user_id', v_claim.user_id
  );
END;
$function$;
REVOKE ALL ON FUNCTION approve_company_claim(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION approve_company_claim(uuid,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.upsert_person_by_name(p_name text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid; v_raw text := trim(coalesce(p_name, '')); v_name text; v_alias text;
BEGIN
  PERFORM public.require_security_admin(true);
  IF v_raw = '' THEN RETURN NULL; END IF;
  v_name := trim(regexp_replace(regexp_replace(v_raw, '\([^()]+\)', '', 'g'), '\[[^\]]+\]', '', 'g'));
  v_alias := NULLIF(trim(substring(v_raw FROM '\(([^()]+)\)')), '');
  IF v_alias IS NULL THEN v_alias := NULLIF(trim(substring(v_raw FROM '\[([^\]]+)\]')), ''); END IF;
  v_id := public.find_person_by_name(v_raw);
  IF v_id IS NULL THEN
    INSERT INTO public.people (name, nationality, source, photo_url, known_for_department)
    VALUES (v_name, coalesce(nullif(p_extra->>'nationality',''), 'Nigerian'), nullif(p_extra->>'source',''), nullif(p_extra->>'photo_url',''), nullif(p_extra->>'known_for_department',''))
    RETURNING id INTO v_id;
  END IF;
  IF v_alias IS NOT NULL THEN INSERT INTO public.person_aliases(person_id, alias, source) VALUES (v_id, v_alias, coalesce(nullif(p_extra->>'source',''), 'ingestion')) ON CONFLICT (person_id, alias_key) DO NOTHING; END IF;
  RETURN v_id;
EXCEPTION WHEN unique_violation THEN RETURN public.find_person_by_name(v_raw);
END;
$function$;
REVOKE ALL ON FUNCTION upsert_person_by_name(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION upsert_person_by_name(text,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.batch_certify_films(film_uuids uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    updated_count INT;
BEGIN
  PERFORM public.require_security_admin(true);
    UPDATE public.films
    SET needs_review = false
    WHERE id = ANY(film_uuids);

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$function$;
REVOKE ALL ON FUNCTION batch_certify_films(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION batch_certify_films(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.batch_create_films_from_videos(video_db_ids uuid[])
 RETURNS TABLE(video_id uuid, new_film_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    vid UUID;
    fid UUID;
    v_title TEXT;
    v_desc TEXT;
    v_poster TEXT;
    v_url TEXT;
    v_year INT;
    v_published TIMESTAMP;
    v_channel_id UUID;
    v_adapter TEXT;
    v_youtube_id TEXT;
    target_release_type TEXT;
BEGIN
  PERFORM public.require_security_admin(true);
    FOREACH vid IN ARRAY video_db_ids
    LOOP
        -- Get video details and channel adapter
        SELECT
            cv.title, cv.description, cv.poster_url, cv.watch_url, cv.published_at, cv.channel_id, c.adapter, cv.video_id
        INTO
            v_title, v_desc, v_poster, v_url, v_published, v_channel_id, v_adapter, v_youtube_id
        FROM channel_videos cv
        JOIN channels c ON cv.channel_id = c.id
        WHERE cv.id = vid;

        -- Determine release type based on channel adapter
        IF v_adapter = 'kava' THEN
            target_release_type := 'kava';
        ELSE
            target_release_type := 'youtube';
        END IF;

        -- Extract year
        v_year := EXTRACT(YEAR FROM v_published);

        -- Insert into films or update if exists by source_video_id
        -- We prioritize source_video_id over title/year for YouTube imports
        INSERT INTO films (
            title,
            synopsis,
            poster_url,
            year,
            release_type,
            youtube_watch_url,
            source_video_id,
            status,
            is_trending,
            is_featured,
            source
        )
        VALUES (
            v_title,
            v_desc,
            v_poster,
            COALESCE(v_year, 2024),
            target_release_type,
            v_url,
            NULLIF(v_youtube_id, ''),
            'released',
            false,
            false,
            'youtube'
        )
        ON CONFLICT (source_video_id) DO UPDATE SET
            youtube_watch_url = EXCLUDED.youtube_watch_url,
            release_type = EXCLUDED.release_type,
            title = CASE WHEN films.title IS NULL OR films.title = '' THEN EXCLUDED.title ELSE films.title END
        RETURNING id INTO fid;

        -- Link the video to the film
        UPDATE channel_videos
        SET film_id = fid,
            match_status = 'manual'
        WHERE id = vid;

        video_id := vid;
        new_film_id := fid;
        RETURN NEXT;
    END LOOP;
END;
$function$;
REVOKE ALL ON FUNCTION batch_create_films_from_videos(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION batch_create_films_from_videos(uuid[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.refresh_all_popularity_scores()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  PERFORM public.require_security_admin(true);
  UPDATE public.people p
  SET film_count = (
    (SELECT COUNT(*) FROM public.credits WHERE person_id = p.id) +
    (
      SELECT COALESCE(COUNT(*), 0)
      FROM public.channel_videos cv
      JOIN public.channels ch ON ch.id = cv.channel_id
      WHERE ch.owner_person_id = p.id
      AND (
        (p.known_for_department = 'Actor' AND cv.duration_seconds >= 2100) OR
        (p.known_for_department = 'Skit Maker' AND cv.duration_seconds >= 900) OR
        (p.known_for_department NOT IN ('Actor', 'Skit Maker') AND cv.duration_seconds >= 900)
      )
    )
  )
  WHERE true;
END;
$function$;
REVOKE ALL ON FUNCTION refresh_all_popularity_scores() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION refresh_all_popularity_scores() TO authenticated, service_role;
