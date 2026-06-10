-- ============================================================
-- SECURITY: Harden signup role assignment
-- ------------------------------------------------------------
-- Previously handle_new_user() copied raw_user_meta_data->>'role'
-- straight into public.users.role, including 'admin'. Because the
-- signup metadata is fully client-controlled, anyone could call
-- auth.signUp({ data: { role: 'admin' } }) and self-promote to admin,
-- which the RLS policies trust for full read/write access.
--
-- This migration removes the 'admin' path entirely. Self-service
-- signup may only ever produce 'fan' or 'professional' (the two
-- account types offered in the UI). Elevated roles must be granted
-- through the authenticated admin_change_role() RPC.
--
-- NOTE: This does NOT demote anyone. Audit public.users for any
-- unexpected 'admin' / 'admin_limited' rows created before this fix:
--   SELECT id, email, role FROM public.users
--   WHERE role IN ('admin','admin_limited');
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name TEXT;
  v_role TEXT;
BEGIN
  -- Name with fallbacks
  v_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    split_part(new.email, '@', 1),
    'User'
  );

  -- SECURITY: never honor a client-supplied 'admin' role.
  -- Only 'professional' is allowed as an elevated self-service tier;
  -- everything else (including 'admin', 'admin_limited', null) -> 'fan'.
  v_role := CASE
    WHEN (new.raw_user_meta_data->>'role') IN ('professional', 'pro', 'industry') THEN 'professional'
    ELSE 'fan'
  END;

  INSERT INTO public.users (id, email, name, role)
  VALUES (new.id, new.email, v_name, v_role::user_role)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    name  = EXCLUDED.name;
    -- Intentionally do NOT overwrite role on conflict: preserve the
    -- existing role so a re-inserted/duplicate auth row cannot reset
    -- (or escalate) an established user's privileges.

  RETURN new;
END;
$$;
