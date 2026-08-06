-- =============================================================================
-- 20260806144000_fix_critic_reviews_rls.sql
-- Fixes RLS policies for `critic_reviews` to use `public.is_admin()` matching
-- the rest of the application.
-- =============================================================================

-- Drop legacy policy if present
DROP POLICY IF EXISTS "Allow admin write access for critic_reviews" ON public.critic_reviews;
DROP POLICY IF EXISTS "sec_admin_critic_reviews_all" ON public.critic_reviews;
DROP POLICY IF EXISTS "sec_admin_critic_reviews_insert" ON public.critic_reviews;
DROP POLICY IF EXISTS "sec_admin_critic_reviews_update" ON public.critic_reviews;
DROP POLICY IF EXISTS "sec_admin_critic_reviews_delete" ON public.critic_reviews;
DROP POLICY IF EXISTS "sec_service_role_critic_reviews" ON public.critic_reviews;

-- Grant PostgREST roles access
GRANT SELECT ON public.critic_reviews TO anon, authenticated, service_role;
GRANT ALL ON public.critic_reviews TO authenticated, service_role;

-- 1. Public Read Policy
DROP POLICY IF EXISTS "Allow public read access for critic_reviews" ON public.critic_reviews;
CREATE POLICY "Allow public read access for critic_reviews"
  ON public.critic_reviews
  FOR SELECT
  USING (true);

-- 2. Admin Policies using public.is_admin()
CREATE POLICY "sec_admin_critic_reviews_insert"
  ON public.critic_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "sec_admin_critic_reviews_update"
  ON public.critic_reviews
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "sec_admin_critic_reviews_delete"
  ON public.critic_reviews
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "sec_service_role_critic_reviews"
  ON public.critic_reviews
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
