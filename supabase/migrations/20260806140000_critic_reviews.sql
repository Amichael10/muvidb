-- =============================================================================
-- 20260806140000_critic_reviews.sql
-- Adds `critic_reviews` table to store expert critic quotes, star ratings,
-- critic names, publication titles, avatars, and links to original reviews.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.critic_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
    critic_name TEXT,
    critic_title TEXT,
    avatar_url TEXT,
    quote TEXT NOT NULL,
    rating NUMERIC(3, 1),
    review_url TEXT,
    is_anonymous BOOLEAN NOT NULL DEFAULT false,
    is_featured BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup per film ordered by recency/featured status
CREATE INDEX IF NOT EXISTS critic_reviews_film_id_idx
    ON public.critic_reviews(film_id, is_featured DESC, created_at DESC);

-- Enable RLS
ALTER TABLE public.critic_reviews ENABLE ROW LEVEL SECURITY;

-- Grants for PostgREST Roles
GRANT SELECT ON public.critic_reviews TO anon, authenticated, service_role;
GRANT ALL ON public.critic_reviews TO authenticated, service_role;

-- 1. Public read access
DROP POLICY IF EXISTS "Allow public read access for critic_reviews" ON public.critic_reviews;
CREATE POLICY "Allow public read access for critic_reviews"
    ON public.critic_reviews
    FOR SELECT
    USING (true);

-- 2. Admin write access (insert, update, delete)
DROP POLICY IF EXISTS "Allow admin write access for critic_reviews" ON public.critic_reviews;
CREATE POLICY "Allow admin write access for critic_reviews"
    ON public.critic_reviews
    FOR ALL
    USING (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
    )
    WITH CHECK (
      auth.role() = 'service_role' OR
      (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'superadmin')
    );
