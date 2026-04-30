-- Fix admin_change_role: cast the new_role text param to the user_role enum
CREATE OR REPLACE FUNCTION public.admin_change_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized_role TEXT;
BEGIN
  -- Normalize role values to valid enum members
  v_normalized_role := CASE new_role
    WHEN 'admin'        THEN 'admin'
    WHEN 'professional' THEN 'professional'
    WHEN 'pro'          THEN 'professional'
    WHEN 'fan'          THEN 'fan'
    WHEN 'user'         THEN 'fan'
    ELSE 'fan'
  END;

  UPDATE public.users
  SET role = v_normalized_role::user_role
  WHERE id = target_user_id;
END;
$$;

-- Fix admin_ban_user in case it has the same issue
CREATE OR REPLACE FUNCTION public.admin_ban_user(
  target_user_id UUID,
  ban_status BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET is_banned = ban_status
  WHERE id = target_user_id;
END;
$$;

-- Fix admin_delete_user
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = target_user_id;
  -- Also delete from auth.users (requires service role)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;
