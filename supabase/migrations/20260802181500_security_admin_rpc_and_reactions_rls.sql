-- =============================================================================
-- Security hardening
-- 1) admin_ban_user / admin_delete_user require is_admin() (closes privilege gap)
-- 2) film_reactions RLS — users can only write their own reactions
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Admin RPCs — keep EXECUTE for authenticated so AdminUsers.jsx (client RPC)
--    still works; reject non-admins inside the SECURITY DEFINER body.
-- ---------------------------------------------------------------------------
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
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  UPDATE public.users
  SET is_banned = ban_status
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  target_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  DELETE FROM public.users WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Tighten grants: no anon/public; authenticated OK (gated by is_admin above);
-- service_role OK for server-side tools.
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. film_reactions — own-row writes; public read for like/dislike counts
-- ---------------------------------------------------------------------------
ALTER TABLE public.film_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "film_reactions_public_read" ON public.film_reactions;
DROP POLICY IF EXISTS "film_reactions_insert_own" ON public.film_reactions;
DROP POLICY IF EXISTS "film_reactions_update_own" ON public.film_reactions;
DROP POLICY IF EXISTS "film_reactions_delete_own" ON public.film_reactions;

CREATE POLICY "film_reactions_public_read"
  ON public.film_reactions
  FOR SELECT
  USING (true);

CREATE POLICY "film_reactions_insert_own"
  ON public.film_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "film_reactions_update_own"
  ON public.film_reactions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "film_reactions_delete_own"
  ON public.film_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
