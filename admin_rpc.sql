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
BEGIN
    -- Security Check: Ensure caller is an admin
    IF (SELECT role FROM public.users WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Update public.users table 
    UPDATE public.users 
    SET role = new_role 
    WHERE id = target_user_id;

    -- Update auth.users app_metadata for RLS constraints & JWT claims
    UPDATE auth.users 
    SET app_metadata = jsonb_set(COALESCE(app_metadata, '{}'::jsonb), '{role}', to_jsonb(new_role)) 
    WHERE id = target_user_id;
END;
$$;
