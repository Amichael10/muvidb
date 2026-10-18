-- Grant table privileges on filmmaker_portfolios.
--
-- The table was created with RLS enabled and correct policies, but no GRANTs.
-- RLS is only consulted AFTER the role passes table-level privilege checks, so
-- every anon/authenticated read failed with:
--
--   42501: permission denied for table filmmaker_portfolios
--
-- fetchPortfolioByHandle() swallows that error and falls through to its
-- "synthetic portfolio" branch, so the public page silently ignored the saved
-- record: custom links never appeared, and tagline, theme_preset,
-- featured_reel_url and inquiry details were all replaced by defaults derived
-- from the people table. The feature looked functional while reading nothing.
--
-- The existing policies remain the real access control:
--   SELECT  -> is_published = true OR auth.uid() = user_id
--   INSERT/UPDATE/DELETE -> auth.uid() = user_id

GRANT SELECT ON public.filmmaker_portfolios TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.filmmaker_portfolios TO authenticated;
