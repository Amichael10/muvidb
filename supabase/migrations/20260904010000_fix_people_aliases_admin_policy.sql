-- Align alias writes with the authorization rule used by the Admin People form.
-- Some deployments do not expose the is_admin() helper consistently through
-- the browser session, while public.users role is the authoritative check.
DROP POLICY IF EXISTS "Admins can manage person aliases" ON public.person_aliases;
CREATE POLICY "Admins can manage person aliases"
  ON public.person_aliases FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited'))
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited'));
