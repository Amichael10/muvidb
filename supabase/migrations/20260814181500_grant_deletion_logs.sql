-- Migration: 20260814181500_grant_deletion_logs.sql
GRANT ALL ON public.deletion_logs TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "deletion_logs_policy" ON public.deletion_logs;
DROP POLICY IF EXISTS "Allow service role full access on deletion_logs" ON public.deletion_logs;
DROP POLICY IF EXISTS "Allow public read on deletion_logs" ON public.deletion_logs;

CREATE POLICY "deletion_logs_policy"
    ON public.deletion_logs FOR ALL
    USING (true)
    WITH CHECK (true);
