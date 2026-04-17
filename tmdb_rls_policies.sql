-- ============================================
-- TMDB Sync RLS Policies
-- Allows insert/update on content tables
-- Run this in Supabase SQL Editor
-- ============================================

-- Films: allow anyone to read, allow inserts/updates (public content)
CREATE POLICY IF NOT EXISTS "Anyone can read films"
  ON public.films FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow film inserts"
  ON public.films FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow film updates"
  ON public.films FOR UPDATE USING (true) WITH CHECK (true);

-- People: public content
CREATE POLICY IF NOT EXISTS "Anyone can read people"
  ON public.people FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow people inserts"
  ON public.people FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow people updates"
  ON public.people FOR UPDATE USING (true) WITH CHECK (true);

-- Companies: public content
DO $$ BEGIN
  ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY IF NOT EXISTS "Anyone can read companies"
  ON public.companies FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow company inserts"
  ON public.companies FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow company updates"
  ON public.companies FOR UPDATE USING (true) WITH CHECK (true);

-- Credits: public content
DO $$ BEGIN
  ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY IF NOT EXISTS "Anyone can read credits"
  ON public.credits FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow credit inserts"
  ON public.credits FOR INSERT WITH CHECK (true);

-- Film_genres: public content
DO $$ BEGIN
  ALTER TABLE public.film_genres ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE POLICY IF NOT EXISTS "Anyone can read film_genres"
  ON public.film_genres FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Allow film_genre inserts"
  ON public.film_genres FOR INSERT WITH CHECK (true);
