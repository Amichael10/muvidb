-- Public catalogue files are published by admins. User submissions continue to
-- use the private contributions bucket and the existing approval workflow.
DROP POLICY IF EXISTS "auth users upload film images" ON storage.objects;
DROP POLICY IF EXISTS "auth users update film images" ON storage.objects;
DROP POLICY IF EXISTS "auth users delete film images" ON storage.objects;

DROP POLICY IF EXISTS "Service role write access for talent_representations" ON public.talent_representations;
CREATE POLICY "Service role write access for talent_representations"
  ON public.talent_representations FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Authorized managers write talent representations" ON public.talent_representations;
CREATE POLICY "Authorized managers write talent representations"
  ON public.talent_representations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text IN ('admin', 'admin_limited'))
    OR EXISTS (SELECT 1 FROM public.actor_profile_access a WHERE a.person_id = talent_representations.person_id AND a.user_id = auth.uid() AND a.status = 'active')
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = talent_representations.company_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role IN ('owner', 'admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text IN ('admin', 'admin_limited'))
    OR EXISTS (SELECT 1 FROM public.actor_profile_access a WHERE a.person_id = talent_representations.person_id AND a.user_id = auth.uid() AND a.status = 'active')
    OR EXISTS (SELECT 1 FROM public.company_members m WHERE m.company_id = talent_representations.company_id AND m.user_id = auth.uid() AND m.status = 'active' AND m.role IN ('owner', 'admin'))
  );

DROP POLICY IF EXISTS deletion_logs_policy ON public.deletion_logs;
REVOKE ALL ON public.deletion_logs FROM anon, authenticated;
GRANT SELECT ON public.deletion_logs TO authenticated;
DROP POLICY IF EXISTS "Admins read deletion audit logs" ON public.deletion_logs;
CREATE POLICY "Admins read deletion audit logs" ON public.deletion_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'admin'));
GRANT ALL ON public.deletion_logs TO service_role;
REVOKE ALL ON FUNCTION public.purge_old_deletion_logs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_deletion_logs() TO service_role;
ALTER FUNCTION public.purge_old_deletion_logs() SET search_path = public;
