-- Stop anon reading internal columns on public.films and public.people.
--
-- Unlike `credits`, these two tables must stay readable: they are the public
-- catalogue, Google indexes them, and roughly 700 browser queries depend on
-- them. Row access is already bounded -- films enforces is_published, and
-- PostgREST caps every request at 1000 rows -- so what is left to fix is the
-- columns, not the rows.
--
-- The columns below have ZERO references anywhere in src/ (verified by grep).
-- They are pipeline bookkeeping and commercial data that no page displays:
--
--   people.pro_plan                  which subscription a person is on
--   people.pro_expires_at            and when it lapses
--   people.photo_cutout_attempted_at image pipeline bookkeeping
--   people.photo_cutout_error
--   people.photo_cutout_source_url
--   people.management_company_id
--
--   films.content_kind               internal AI classification
--   films.content_kind_checked_at
--   films.content_kind_confidence    how sure the classifier was
--   films.comments_synced_at         pipeline bookkeeping
--   films.nfvcb_rating_verified_at
--   films.nfvcb_rating_source
--
-- The billing pair is the real motivation: a person's plan and expiry had no
-- business being world-readable.
--
-- PREREQUISITE, ALREADY SHIPPED (1f97611): every anon-reachable `select('*')`
-- on these tables was replaced with an explicit column list, because PostgREST
-- 401s the ENTIRE query when any requested column lacks SELECT. Revoking while
-- a deployed bundle still asked for `*` would blank the homepage rails and the
-- quick-view modal. Code first, revoke second -- reversing that order broke
-- person-page navigation earlier today.
--
-- `authenticated` and `service_role` are untouched. ClaimProfile and Dashboard
-- still use select('*') and both sit inside the require-auth layout, so they
-- keep working on the authenticated grant.
--
-- Non-destructive: privileges only, no data touched. Roll back by re-granting
-- the same column lists to anon.

revoke select (
  pro_plan,
  pro_expires_at,
  photo_cutout_attempted_at,
  photo_cutout_error,
  photo_cutout_source_url,
  management_company_id
) on public.people from anon;

revoke select (
  content_kind,
  content_kind_checked_at,
  content_kind_confidence,
  comments_synced_at,
  nfvcb_rating_verified_at,
  nfvcb_rating_source
) on public.films from anon;

-- Verify afterwards with the ANON key, not service_role:
--   select=*                -> expect 401 (it requests the revoked columns)
--   select=pro_plan         -> expect 401
--   select=id,name,slug     -> expect 200
--   and load the homepage signed out: the in-cinemas rail, spotlight/crew/
--   creators rails and the quick-view modal must all still populate.
