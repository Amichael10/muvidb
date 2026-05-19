-- Recreate trigger function public.handle_user_sync with explicit casts and safe exception handling
CREATE OR REPLACE FUNCTION public.handle_user_sync() 
RETURNS trigger AS $$
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
      WHEN (new.raw_user_meta_data->>'role') = 'admin' THEN 'admin'
      WHEN (new.raw_user_meta_data->>'role') = 'admin_limited' THEN 'admin_limited'
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
