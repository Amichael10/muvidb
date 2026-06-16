-- ============================================================
-- Fix Supabase Security Lints
-- Generated from: Supabase Performance Security Lints (pkenrmorywmuvnzfoylp)
-- ============================================================

-- ============================================================
-- SECTION 1: Fix Function Search Path Mutable (lint: 0011)
-- All functions in public schema need SET search_path = ''
-- to prevent search_path injection attacks.
-- ============================================================

ALTER FUNCTION public.calculate_popularity_score SET search_path = '';
ALTER FUNCTION public.update_popularity_on_view_change SET search_path = '';
ALTER FUNCTION public.update_popularity_on_credit_change SET search_path = '';
ALTER FUNCTION public.generate_slug SET search_path = '';
ALTER FUNCTION public.get_my_role SET search_path = '';
ALTER FUNCTION public.create_pro_profile SET search_path = '';
ALTER FUNCTION public.update_updated_at SET search_path = '';
ALTER FUNCTION public.refresh_film_average_rating SET search_path = '';
ALTER FUNCTION public.refresh_all_popularity_scores SET search_path = '';
ALTER FUNCTION public.batch_create_films_from_videos SET search_path = '';
ALTER FUNCTION public.auto_slug_films SET search_path = '';
ALTER FUNCTION public.auto_slug_people SET search_path = '';
ALTER FUNCTION public.auto_slug_channels SET search_path = '';
ALTER FUNCTION public.auto_slug_companies SET search_path = '';
ALTER FUNCTION public.batch_certify_films SET search_path = '';
ALTER FUNCTION public.get_people_with_counts SET search_path = '';
ALTER FUNCTION public.handle_new_user SET search_path = '';
ALTER FUNCTION public.handle_user_sync SET search_path = '';

-- merge_people has two signatures
ALTER FUNCTION public.merge_people(p_master_id uuid, p_duplicate_ids uuid[]) SET search_path = '';
ALTER FUNCTION public.merge_people(p_primary_id uuid, p_secondary_id uuid, p_metadata jsonb) SET search_path = '';

-- merge_films
ALTER FUNCTION public.merge_films(p_primary_id uuid, p_secondary_id uuid, p_metadata jsonb) SET search_path = '';


-- ============================================================
-- SECTION 2: Fix Admin Functions Accessible by anon/authenticated
-- (lint: 0028 + 0029)
-- These SECURITY DEFINER admin functions should NOT be callable
-- by anon or regular authenticated users.
-- We REVOKE EXECUTE from anon and authenticated, then only
-- grant to service_role (or use an internal role check).
-- ============================================================

-- admin_ban_user
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) FROM public;

-- admin_change_role
REVOKE EXECUTE ON FUNCTION public.admin_change_role(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_change_role(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_change_role(uuid, text) FROM public;

-- admin_delete_user
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_delete_user(uuid) FROM public;

-- batch_certify_films (admin-only operation)
REVOKE EXECUTE ON FUNCTION public.batch_certify_films(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_certify_films(uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.batch_certify_films(uuid[]) FROM public;

-- batch_create_films_from_videos (admin-only operation)
REVOKE EXECUTE ON FUNCTION public.batch_create_films_from_videos(uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.batch_create_films_from_videos(uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.batch_create_films_from_videos(uuid[]) FROM public;

-- create_pro_profile: authenticated users should be able to call this for themselves
-- but anon should not. Keep authenticated access, revoke anon only.
REVOKE EXECUTE ON FUNCTION public.create_pro_profile(uuid, text, text, text) FROM anon;
-- NOTE: If you want only the user themselves to call this, add a check inside the function:
-- IF auth.uid() != user_id THEN RAISE EXCEPTION 'Forbidden'; END IF;

-- get_people_with_counts: public search is intentional - but anon should not
-- have SECURITY DEFINER access. This should be SECURITY INVOKER.
-- We revoke anon access; authenticated can call it:
REVOKE EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) FROM anon;

-- handle_new_user: this is a trigger function, should not be callable via RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public;

-- handle_user_sync: trigger function, should not be callable via RPC
REVOKE EXECUTE ON FUNCTION public.handle_user_sync() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_user_sync() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_user_sync() FROM public;

-- merge_films: admin-only
REVOKE EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) FROM public;

-- merge_people (both overloads): admin-only
REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid[]) FROM public;

REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) FROM public;

-- refresh_all_popularity_scores: admin/service-only operation
REVOKE EXECUTE ON FUNCTION public.refresh_all_popularity_scores() FROM anon;
REVOKE EXECUTE ON FUNCTION public.refresh_all_popularity_scores() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_all_popularity_scores() FROM public;

-- Grant to service_role so backend/edge functions can still call them
GRANT EXECUTE ON FUNCTION public.admin_ban_user(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_change_role(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_certify_films(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.batch_create_films_from_videos(uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_pro_profile(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_people_with_counts(text, text, text, text, boolean, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_films(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_people(uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_popularity_scores() TO service_role;


-- ============================================================
-- SECTION 3: Fix Overly Permissive RLS Policies (lint: 0024)
-- Replace USING (true) / WITH CHECK (true) on write operations
-- with proper role-based checks.
-- ============================================================

-- ---- channel_flags: "Anyone can flag a channel" INSERT ----
-- Currently: WITH CHECK (true) — anyone can insert
-- Fix: Only authenticated users can flag
DROP POLICY IF EXISTS "Anyone can flag a channel" ON public.channel_flags;
DROP POLICY IF EXISTS "Authenticated users can flag a channel" ON public.channel_flags;
CREATE POLICY "Authenticated users can flag a channel"
  ON public.channel_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);


-- ---- channels: "Admins can do everything on channels" ALL ----
-- Currently: USING (true) WITH CHECK (true) for authenticated
-- Fix: Only admins (check role in user metadata) can do everything
DROP POLICY IF EXISTS "Admins can do everything on channels" ON public.channels;
CREATE POLICY "Admins can do everything on channels"
  ON public.channels
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  );


-- ---- companies: "Allow company inserts" INSERT ----
-- Fix: Only authenticated users can insert companies
DROP POLICY IF EXISTS "Allow company inserts" ON public.companies;
CREATE POLICY "Allow company inserts"
  ON public.companies
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- companies: "Allow company updates" UPDATE ----
-- Fix: Only admins can update companies (or owners if there is an owner field)
DROP POLICY IF EXISTS "Allow company updates" ON public.companies;
CREATE POLICY "Allow company updates"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  );


-- ---- credits: "Allow credit inserts" INSERT ----
-- Fix: Only authenticated users can insert credits
DROP POLICY IF EXISTS "Allow credit inserts" ON public.credits;
CREATE POLICY "Allow credit inserts"
  ON public.credits
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);


-- ---- film_genres: "Allow film_genre inserts" INSERT ----
-- Fix: Only authenticated users can insert film genres
DROP POLICY IF EXISTS "Allow film_genre inserts" ON public.film_genres;
CREATE POLICY "Allow film_genre inserts"
  ON public.film_genres
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);


-- ---- films: "Allow film inserts" INSERT ----
-- Fix: Only authenticated users can insert films
DROP POLICY IF EXISTS "Allow film inserts" ON public.films;
CREATE POLICY "Allow film inserts"
  ON public.films
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- films: "Allow film updates" UPDATE ----
-- Fix: Only admins can update films
DROP POLICY IF EXISTS "Allow film updates" ON public.films;
CREATE POLICY "Allow film updates"
  ON public.films
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  );


-- ---- people: "Allow people inserts" INSERT ----
-- Fix: Only authenticated users can insert people records
DROP POLICY IF EXISTS "Allow people inserts" ON public.people;
CREATE POLICY "Allow people inserts"
  ON public.people
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---- people: "Allow people updates" UPDATE ----
-- Fix: Only admins can update people records
DROP POLICY IF EXISTS "Allow people updates" ON public.people;
CREATE POLICY "Allow people updates"
  ON public.people
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
    OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
  );


-- ---- waitlist: "Allow anonymous signups" INSERT ----
-- This is intentionally open for public signups, but we can tighten it
-- to prevent abuse: rate-limit via application layer or add a minimal check.
-- Keep anon access but ensure the policy is correct:
DROP POLICY IF EXISTS "Allow anonymous signups" ON public.waitlist;
CREATE POLICY "Allow anonymous signups"
  ON public.waitlist
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- NOTE: The above keeps the original intent (public signup form).
-- Supabase flags it because WITH CHECK (true) is permissive.
-- This is acceptable for a public waitlist. If you want to lock it down further,
-- consider adding rate limiting at the application or edge function layer.


-- ============================================================
-- SECTION 4: Fix Public Bucket Broad SELECT Policy (lint: 0025)
-- The "film-images" bucket has a broad SELECT policy that allows
-- clients to LIST all files. For a public bucket, URL access
-- doesn't require a storage policy; remove the broad SELECT policy.
-- ============================================================

-- Remove the overly broad SELECT policy on storage.objects for film-images.
-- Public bucket files are accessible by URL without any storage policy.
-- The listing policy is unnecessary and exposes the bucket structure.
DROP POLICY IF EXISTS "public view film images" ON storage.objects;

-- If you need authenticated users to be able to list images for admin purposes,
-- create a more restrictive policy:
-- CREATE POLICY "Admins can list film images"
--   ON storage.objects
--   FOR SELECT
--   TO authenticated
--   USING (
--     bucket_id = 'film-images'
--     AND (
--       (auth.jwt() -> 'user_metadata' ->> 'role') IN ('admin', 'admin_limited')
--       OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'admin_limited')
--     )
--   );
