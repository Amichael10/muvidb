-- Grant table permissions on person_aliases for Supabase PostgREST
GRANT ALL ON TABLE public.person_aliases TO authenticated, service_role;
GRANT SELECT ON TABLE public.person_aliases TO anon;

-- Ensure RLS is active and allows reading and admin management
ALTER TABLE public.person_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read person aliases" ON public.person_aliases;
DROP POLICY IF EXISTS "Anyone can read person aliases" ON public.person_aliases;
CREATE POLICY "Anyone can read person aliases"
  ON public.person_aliases FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage person aliases" ON public.person_aliases;
CREATE POLICY "Admins can manage person aliases"
  ON public.person_aliases FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role::text IN ('admin', 'admin_limited')
    )
    OR (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role::text IN ('admin', 'admin_limited')
    )
    OR (auth.jwt() ->> 'role') = 'service_role'
  );
