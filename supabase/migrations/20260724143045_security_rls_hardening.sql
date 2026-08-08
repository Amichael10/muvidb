-- =============================================================================
-- SECURITY RLS HARDENING
-- =============================================================================
-- Promoted from the orphaned loose file sql/security_rls_hardening.sql, which
-- was written after the 2026-06-26 RLS audit but never applied — loose .sql
-- files in sql/ are not part of the migration pipeline, so this security fix
-- sat unapplied in production. Content is unchanged from that file.
--
-- The vulnerability: many content tables had write policies *named* like
-- "admins can ..." whose actual rule was only `auth.uid() IS NOT NULL` — i.e.
-- ANY logged-in user could insert/update/DELETE films, people, credits, the
-- homepage Top 10, etc. Postgres OR's permissive policies together, so these
-- loose policies also defeated the correct admin-only ones sitting beside them.
--
-- This migration:
--   1. adds an is_admin() helper,
--   2. drops every loose write policy on content tables,
--   3. (re)creates clean admin-only INSERT/UPDATE/DELETE policies,
--      while KEEPING the intentional `professional`-role insert policies,
--   4. applies the real 5-minute edit/delete window on reviews.
--
-- Public SELECT policies are left untouched (reads stay open, including the
-- country-visibility logic on films/people/channels). Idempotent, safe to re-run.
--
-- Service-role writes (the cron sync, api/_lib/supabase.ts) bypass RLS entirely
-- and are unaffected.
--
-- AFTER applying: log in as an admin and confirm you can still create/edit/delete
-- a film, and that a normal (non-admin) logged-in account CANNOT.
-- =============================================================================

-- 1. Admin check helper (security definer so it can read public.users under RLS).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid()
      and role in ('admin'::user_role, 'admin_limited'::user_role)
  );
$$;

-- 2. Helper: a clean admin write policy set for a table is created inline below.
--    (No dynamic SQL — explicit per table so it's auditable.)

-- ---------------------------------------------------------------------------
-- FILMS  (keep "Allow film inserts" = professional+admin, "Allow film updates")
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert films" on public.films;
drop policy if exists "admins can update films" on public.films;
drop policy if exists "admins can delete films" on public.films;
drop policy if exists "sec_admin_insert" on public.films;
drop policy if exists "sec_admin_update" on public.films;
drop policy if exists "sec_admin_delete" on public.films;
create policy "sec_admin_insert" on public.films for insert to authenticated with check (public.is_admin());
create policy "sec_admin_update" on public.films for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.films for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- PEOPLE  (keep "Allow people updates" = admin)
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert people" on public.people;
drop policy if exists "admins can update people" on public.people;
drop policy if exists "admins can delete people" on public.people;
drop policy if exists "Allow people inserts" on public.people;
drop policy if exists "sec_admin_insert" on public.people;
drop policy if exists "sec_admin_delete" on public.people;
create policy "sec_admin_insert" on public.people for insert to authenticated with check (public.is_admin());
create policy "sec_admin_delete" on public.people for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- CREDITS  (keep "Allow credit inserts" = professional+admin)
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert credits" on public.credits;
drop policy if exists "admins can update credits" on public.credits;
drop policy if exists "admins can delete credits" on public.credits;
drop policy if exists "sec_admin_update" on public.credits;
drop policy if exists "sec_admin_delete" on public.credits;
create policy "sec_admin_update" on public.credits for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.credits for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- COMPANIES  (keep "Allow company updates" = admin)
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert companies" on public.companies;
drop policy if exists "admins can update companies" on public.companies;
drop policy if exists "admins can delete companies" on public.companies;
drop policy if exists "Allow company inserts" on public.companies;
drop policy if exists "sec_admin_insert" on public.companies;
drop policy if exists "sec_admin_delete" on public.companies;
create policy "sec_admin_insert" on public.companies for insert to authenticated with check (public.is_admin());
create policy "sec_admin_delete" on public.companies for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- FILM_COMPANIES
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert film_companies" on public.film_companies;
drop policy if exists "admins can delete film_companies" on public.film_companies;
drop policy if exists "sec_admin_insert" on public.film_companies;
drop policy if exists "sec_admin_update" on public.film_companies;
drop policy if exists "sec_admin_delete" on public.film_companies;
create policy "sec_admin_insert" on public.film_companies for insert to authenticated with check (public.is_admin());
create policy "sec_admin_update" on public.film_companies for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.film_companies for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- FILM_GENRES  (keep "Allow film_genre inserts" = professional+admin)
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert film_genres" on public.film_genres;
drop policy if exists "admins can delete film_genres" on public.film_genres;
drop policy if exists "sec_admin_delete" on public.film_genres;
create policy "sec_admin_delete" on public.film_genres for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- SHOWTIMES
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert showtimes" on public.showtimes;
drop policy if exists "admins can update showtimes" on public.showtimes;
drop policy if exists "admins can delete showtimes" on public.showtimes;
drop policy if exists "sec_admin_insert" on public.showtimes;
drop policy if exists "sec_admin_update" on public.showtimes;
drop policy if exists "sec_admin_delete" on public.showtimes;
create policy "sec_admin_insert" on public.showtimes for insert to authenticated with check (public.is_admin());
create policy "sec_admin_update" on public.showtimes for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.showtimes for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- YOUTUBE_CHANNELS
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert channels" on public.youtube_channels;
drop policy if exists "admins can update channels" on public.youtube_channels;
drop policy if exists "admins can delete channels" on public.youtube_channels;
drop policy if exists "sec_admin_insert" on public.youtube_channels;
drop policy if exists "sec_admin_update" on public.youtube_channels;
drop policy if exists "sec_admin_delete" on public.youtube_channels;
create policy "sec_admin_insert" on public.youtube_channels for insert to authenticated with check (public.is_admin());
create policy "sec_admin_update" on public.youtube_channels for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.youtube_channels for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- YOUTUBE_STATS  (writes normally come from the cron sync via service-role,
-- which bypasses RLS; this just stops random users writing fake stats.)
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert youtube_stats" on public.youtube_stats;
drop policy if exists "sec_admin_insert" on public.youtube_stats;
drop policy if exists "sec_admin_update" on public.youtube_stats;
drop policy if exists "sec_admin_delete" on public.youtube_stats;
create policy "sec_admin_insert" on public.youtube_stats for insert to authenticated with check (public.is_admin());
create policy "sec_admin_update" on public.youtube_stats for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.youtube_stats for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- TRAILER_REVIEW_QUEUE
-- ---------------------------------------------------------------------------
drop policy if exists "admins can insert queue" on public.trailer_review_queue;
drop policy if exists "admins can update queue" on public.trailer_review_queue;
drop policy if exists "sec_admin_insert" on public.trailer_review_queue;
drop policy if exists "sec_admin_update" on public.trailer_review_queue;
drop policy if exists "sec_admin_delete" on public.trailer_review_queue;
create policy "sec_admin_insert" on public.trailer_review_queue for insert to authenticated with check (public.is_admin());
create policy "sec_admin_update" on public.trailer_review_queue for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "sec_admin_delete" on public.trailer_review_queue for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- SPOTLIGHTS  (homepage editorial — admin only)
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated full access to spotlights" on public.spotlights;
drop policy if exists "sec_admin_all" on public.spotlights;
create policy "sec_admin_all" on public.spotlights for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- TOP_10_FILMS  (homepage editorial — admin only)
-- ---------------------------------------------------------------------------
drop policy if exists "Allow authenticated full access to top_10_films" on public.top_10_films;
drop policy if exists "sec_admin_all" on public.top_10_films;
create policy "sec_admin_all" on public.top_10_films for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- REVIEWS — enforce the 5-minute edit/delete window (was: edit forever)
-- ---------------------------------------------------------------------------
drop policy if exists "users update own reviews" on public.reviews;
drop policy if exists "Allow user update own reviews" on public.reviews;
drop policy if exists "users delete own reviews" on public.reviews;
drop policy if exists "Allow user delete own reviews" on public.reviews;
drop policy if exists "reviews_update_own_window" on public.reviews;
drop policy if exists "reviews_delete_own_window" on public.reviews;
create policy "reviews_update_own_window" on public.reviews for update to authenticated
  using (auth.uid() = user_id and created_at > now() - interval '5 minutes')
  with check (auth.uid() = user_id);
create policy "reviews_delete_own_window" on public.reviews for delete to authenticated
  using (auth.uid() = user_id and created_at > now() - interval '5 minutes');
