-- Grants for PostgREST Roles on critic_reviews table
GRANT SELECT ON public.critic_reviews TO anon, authenticated, service_role;
GRANT ALL ON public.critic_reviews TO authenticated, service_role;

-- Ensure RLS Policies allow admin writes
DROP POLICY IF EXISTS "Allow admin write access for critic_reviews" ON public.critic_reviews;
CREATE POLICY "Allow admin write access for critic_reviews"
    ON public.critic_reviews
    FOR ALL
    USING (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
    )
    WITH CHECK (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
    );
