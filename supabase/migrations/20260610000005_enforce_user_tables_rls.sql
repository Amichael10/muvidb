-- Enable Row Level Security (RLS) on user-write tables
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_claims ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 1. REVIEWS POLICIES
-- =====================================================================
DROP POLICY IF EXISTS "Allow public read access" ON public.reviews;
CREATE POLICY "Allow public read access" ON public.reviews
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Allow user insert own reviews" ON public.reviews;
CREATE POLICY "Allow user insert own reviews" ON public.reviews
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user update own reviews" ON public.reviews;
CREATE POLICY "Allow user update own reviews" ON public.reviews
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user delete own reviews" ON public.reviews;
CREATE POLICY "Allow user delete own reviews" ON public.reviews
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- =====================================================================
-- 2. WATCHLIST POLICIES
-- =====================================================================
DROP POLICY IF EXISTS "Allow user read own watchlist" ON public.watchlist;
CREATE POLICY "Allow user read own watchlist" ON public.watchlist
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user insert own watchlist" ON public.watchlist;
CREATE POLICY "Allow user insert own watchlist" ON public.watchlist
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user delete own watchlist" ON public.watchlist;
CREATE POLICY "Allow user delete own watchlist" ON public.watchlist
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- =====================================================================
-- 3. FOLLOWS POLICIES
-- =====================================================================
DROP POLICY IF EXISTS "Allow user read own follows" ON public.follows;
CREATE POLICY "Allow user read own follows" ON public.follows
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user insert own follows" ON public.follows;
CREATE POLICY "Allow user insert own follows" ON public.follows
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user delete own follows" ON public.follows;
CREATE POLICY "Allow user delete own follows" ON public.follows
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- =====================================================================
-- 4. PROFILE_CLAIMS POLICIES
-- =====================================================================
DROP POLICY IF EXISTS "Allow user read own claims" ON public.profile_claims;
CREATE POLICY "Allow user read own claims" ON public.profile_claims
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow user insert own claims" ON public.profile_claims;
CREATE POLICY "Allow user insert own claims" ON public.profile_claims
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow admins to manage claims (SELECT/UPDATE)
DROP POLICY IF EXISTS "Allow admins read all claims" ON public.profile_claims;
CREATE POLICY "Allow admins read all claims" ON public.profile_claims
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid() AND users.role = 'admin'
        )
    );
