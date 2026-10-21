-- Stop the anon (publishable) key reading public.credits.
--
-- credits holds ~174,900 rows with no row filter, and the anon key ships inside
-- build/client/assets/*.js, so the whole harvested-credits dataset could be
-- paged straight out of PostgREST in minutes. It is the most expensive asset in
-- the project (OCR credit harvesting), so it gets function-level access only.
--
-- Every signed-out-reachable page now reads credits through /api/content
-- (api/_lib/content_handler.ts), which queries with the service-role client one
-- entity at a time and caps row counts. Those callers shipped in 072475d and
-- 6077c59 and were verified against production before this ran -- PostgREST
-- 401s the ENTIRE query when any requested column lacks SELECT, so the code
-- must always land first.
--
-- `authenticated` and `service_role` are deliberately untouched: the company
-- roster editor, filmmaker portfolios, the user dashboard, every admin screen
-- and all api/ functions keep working exactly as before.
--
-- Non-destructive: this removes a privilege only. No rows are touched. Roll
-- back instantly with `grant select on public.credits to anon;`.

revoke select on public.credits from anon;

-- The RLS policy stays as it is. Policies and GRANTs are independent -- the
-- policy remains correct for authenticated users, and removing the GRANT is
-- what actually stops anon. (cf. filmmaker_portfolios, which had correct RLS
-- but no GRANT and silently read empty for days.)
