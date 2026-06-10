-- ============================================================
-- Scope film / credit / film_genre inserts to contributors
-- ------------------------------------------------------------
-- Previously these INSERT policies used WITH CHECK (auth.uid() IS NOT NULL),
-- i.e. ANY logged-in user (including a plain 'fan') could insert films and
-- credits. Restrict inserts to professional accounts and admins so the
-- intended flow is: an actor signs up as 'professional', claims their
-- profile, and can then contribute films/credits — while fans cannot.
--
-- NOTE: the YouTube/TMDB sync jobs insert via the Supabase SERVICE ROLE key,
-- which bypasses RLS entirely, so automated film creation is unaffected.
-- ============================================================

DROP POLICY IF EXISTS "Allow film inserts" ON public.films;
CREATE POLICY "Allow film inserts"
  ON public.films
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid())
      IN ('professional', 'admin', 'admin_limited')
  );

DROP POLICY IF EXISTS "Allow credit inserts" ON public.credits;
CREATE POLICY "Allow credit inserts"
  ON public.credits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid())
      IN ('professional', 'admin', 'admin_limited')
  );

DROP POLICY IF EXISTS "Allow film_genre inserts" ON public.film_genres;
CREATE POLICY "Allow film_genre inserts"
  ON public.film_genres
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid())
      IN ('professional', 'admin', 'admin_limited')
  );
