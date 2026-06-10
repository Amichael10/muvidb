-- ============================================================
-- Restore Admin Access
-- This migration fixes the admin RLS policies that incorrectly relied on JWT claims,
-- restoring them to check the `public.users` table.
-- It also re-grants EXECUTE permissions to the `authenticated` role for admin functions.
-- ============================================================

-- 1. Re-grant EXECUTE on admin functions to `authenticated` role
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_change_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_certify_films(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.batch_create_films_from_videos(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_pro_profile(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_all_popularity_scores() TO authenticated;

-- 2. Restore RLS Policies to use `public.users` table check instead of JWT metadata

-- Fix channels ALL
DROP POLICY IF EXISTS "Admins can do everything on channels" ON public.channels;
CREATE POLICY "Admins can do everything on channels"
  ON public.channels
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  );

-- Fix companies UPDATE
DROP POLICY IF EXISTS "Allow company updates" ON public.companies;
CREATE POLICY "Allow company updates"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  );

-- Fix films UPDATE
DROP POLICY IF EXISTS "Allow film updates" ON public.films;
CREATE POLICY "Allow film updates"
  ON public.films
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  );

-- Fix people UPDATE
DROP POLICY IF EXISTS "Allow people updates" ON public.people;
CREATE POLICY "Allow people updates"
  ON public.people
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited')
  );
