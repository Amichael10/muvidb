-- ============================================================
-- SECURITY: Fix over-permissive profile_claims policies + follower counts
-- ------------------------------------------------------------
-- Two pre-existing, misnamed policies on profile_claims were far more
-- permissive than their names implied:
--
--   * "admins can update claims" (UPDATE, role public)
--       USING (auth.uid() IS NOT NULL)
--     => ANY logged-in user could update ANY claim row, including
--        self-approving (status='approved') or repointing person_id.
--
--   * "admins can read all claims" (SELECT, role public)
--       USING (true)
--     => every claim (user_id <-> claimed identity) was world-readable.
--
-- Legitimate admin read+update is already covered by the role-checked
-- "Allow admins read all claims" (FOR ALL) policy, and owners keep read
-- access via the own-row policies, so both bad policies are dropped.
--
-- Also restores public follower counts: useFollow.js counts follows by
-- person_id across all users, so reads must be public. Writes remain
-- owner-scoped via the insert/delete policies.
-- ============================================================

DROP POLICY IF EXISTS "admins can update claims"  ON public.profile_claims;
DROP POLICY IF EXISTS "admins can read all claims" ON public.profile_claims;

DROP POLICY IF EXISTS "Allow user read own follows" ON public.follows;
DROP POLICY IF EXISTS "Allow public read access"    ON public.follows;
CREATE POLICY "Allow public read access" ON public.follows
    FOR SELECT TO public
    USING (true);
