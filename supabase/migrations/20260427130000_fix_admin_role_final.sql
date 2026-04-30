-- Fix admin_change_role: ensure explicit cast and app_metadata update
CREATE OR REPLACE FUNCTION admin_change_role(target_user_id UUID, new_role TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_normalized_role TEXT;
BEGIN
    -- Security Check: Ensure caller is an admin
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Normalize role values to valid enum members
    v_normalized_role := CASE new_role
      WHEN 'admin'        THEN 'admin'
      WHEN 'professional' THEN 'professional'
      WHEN 'pro'          THEN 'professional'
      WHEN 'fan'          THEN 'fan'
      WHEN 'user'         THEN 'fan'
      ELSE new_role -- Allow direct enum values if they match
    END;

    -- Update public.users table (cast TEXT -> user_role enum explicitly)
    UPDATE public.users 
    SET role = v_normalized_role::user_role
    WHERE id = target_user_id;

    -- Update auth.users app_metadata for RLS constraints & JWT claims
    UPDATE auth.users 
    SET app_metadata = jsonb_set(COALESCE(app_metadata, '{}'::jsonb), '{role}', to_jsonb(v_normalized_role)) 
    WHERE id = target_user_id;
END;
$$;
