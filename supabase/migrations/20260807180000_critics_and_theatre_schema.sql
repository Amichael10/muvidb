-- =============================================================================
-- 20260807180000_critics_and_theatre_schema.sql
-- Adds `critics`, `plays`, and `stage_credits` tables to MuviDB.
-- =============================================================================

-- 1. CRITICS TABLE
CREATE TABLE IF NOT EXISTS public.critics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    publication TEXT,
    bio TEXT,
    avatar_url TEXT,
    platform TEXT,
    handle TEXT,
    profile_url TEXT,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by slug & name
CREATE INDEX IF NOT EXISTS critics_slug_idx ON public.critics(slug);
CREATE INDEX IF NOT EXISTS critics_name_idx ON public.critics(name);

-- 2. LINK CRITIC_REVIEWS TO CRITICS TABLE
ALTER TABLE public.critic_reviews
ADD COLUMN IF NOT EXISTS critic_id UUID REFERENCES public.critics(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS critic_reviews_critic_id_idx ON public.critic_reviews(critic_id);

-- 3. THEATRE PLAYS TABLE
CREATE TABLE IF NOT EXISTS public.plays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    playwright TEXT,
    director TEXT,
    producer TEXT,
    venue TEXT,
    city TEXT,
    country TEXT DEFAULT 'Nigeria',
    poster_url TEXT,
    banner_url TEXT,
    synopsis TEXT,
    genre TEXT,
    year INT,
    run_start_date DATE,
    run_end_date DATE,
    status TEXT NOT NULL DEFAULT 'archived', -- 'currently_running', 'upcoming', 'archived'
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plays_slug_idx ON public.plays(slug);
CREATE INDEX IF NOT EXISTS plays_status_idx ON public.plays(status, run_start_date DESC);

-- 4. STAGE CREDITS TABLE (Linking Actors to Stage Plays)
CREATE TABLE IF NOT EXISTS public.stage_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    play_id UUID NOT NULL REFERENCES public.plays(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'Actor', -- 'Actor', 'Director', 'Playwright', 'Producer', etc.
    character_name TEXT,
    billing_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(play_id, person_id, role)
);

CREATE INDEX IF NOT EXISTS stage_credits_play_id_idx ON public.stage_credits(play_id);
CREATE INDEX IF NOT EXISTS stage_credits_person_id_idx ON public.stage_credits(person_id);

-- 5. ROW LEVEL SECURITY (RLS) & PERMISSIONS
ALTER TABLE public.critics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_credits ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.critics TO anon, authenticated, service_role;
GRANT ALL ON public.critics TO authenticated, service_role;

GRANT SELECT ON public.plays TO anon, authenticated, service_role;
GRANT ALL ON public.plays TO authenticated, service_role;

GRANT SELECT ON public.stage_credits TO anon, authenticated, service_role;
GRANT ALL ON public.stage_credits TO authenticated, service_role;

-- Public Read Policies
DROP POLICY IF EXISTS "Allow public read access for critics" ON public.critics;
CREATE POLICY "Allow public read access for critics" ON public.critics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for plays" ON public.plays;
CREATE POLICY "Allow public read access for plays" ON public.plays FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access for stage_credits" ON public.stage_credits;
CREATE POLICY "Allow public read access for stage_credits" ON public.stage_credits FOR SELECT USING (true);

-- Admin Write Policies
DROP POLICY IF EXISTS "sec_admin_critics_all" ON public.critics;
CREATE POLICY "sec_admin_critics_all" ON public.critics FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sec_admin_plays_all" ON public.plays;
CREATE POLICY "sec_admin_plays_all" ON public.plays FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "sec_admin_stage_credits_all" ON public.stage_credits;
CREATE POLICY "sec_admin_stage_credits_all" ON public.stage_credits FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
