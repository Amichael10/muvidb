-- 1. Function to permanently delete a user
CREATE OR REPLACE FUNCTION admin_delete_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Security Check: Ensure caller is an admin
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Delete from auth.users
    -- If your foreign keys are ON DELETE CASCADE, this will also wipe public.users and associated data.
    DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;


-- 2. Function to ban or unban a user
CREATE OR REPLACE FUNCTION admin_ban_user(target_user_id UUID, ban_status BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Security Check: Ensure caller is an admin
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF ban_status = true THEN
        -- Ban effectively permanently (100 years into the future)
        UPDATE auth.users 
        SET banned_until = CURRENT_TIMESTAMP + interval '100 years'
        WHERE id = target_user_id;
    ELSE
        -- Remove ban
        UPDATE auth.users 
        SET banned_until = NULL
        WHERE id = target_user_id;
    END IF;
END;
$$;


-- 3. Function to change a user's role
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

    -- 1. Update public.users table (cast TEXT -> user_role enum explicitly)
    UPDATE public.users 
    SET role = v_normalized_role::user_role
    WHERE id = target_user_id;

    -- 2. Update auth.users raw_app_meta_data for RLS constraints & JWT claims
    -- Note: The column is named raw_app_meta_data in the auth.users table
    UPDATE auth.users 
    SET raw_app_meta_data = jsonb_set(
      COALESCE(raw_app_meta_data, '{}'::jsonb), 
      '{role}', 
      to_jsonb(v_normalized_role)
    ) 
    WHERE id = target_user_id;
END;
$$;
