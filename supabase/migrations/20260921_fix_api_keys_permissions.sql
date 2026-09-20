-- ============================================================
-- Fix Table Permissions & RLS Policies for public.api_keys
-- Run this in the Supabase Dashboard SQL Editor:
-- https://supabase.com/dashboard/project/pkenrmorywmuvnzfoylp/sql/new
-- ============================================================

-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    scopes TEXT[] NOT NULL DEFAULT '{}',
    rate_limit_per_min INT NOT NULL DEFAULT 60,
    usage_count BIGINT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys (is_active);

-- 2. CRITICAL: Grant table permissions to Supabase roles
-- (Without these, PostgreSQL throws 42501 "permission denied for table api_keys")
GRANT ALL ON TABLE public.api_keys TO postgres;
GRANT ALL ON TABLE public.api_keys TO service_role;
GRANT ALL ON TABLE public.api_keys TO authenticated;
GRANT SELECT ON TABLE public.api_keys TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, service_role, authenticated;

-- Ensure future tables in public schema automatically have permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role, authenticated;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 4. Recreate RLS policies cleanly
DROP POLICY IF EXISTS "Admins can manage api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Service role full access on api_keys" ON public.api_keys;
DROP POLICY IF EXISTS "Service role full access" ON public.api_keys;

-- Allow service_role complete access (bypasses RLS)
CREATE POLICY "Service role full access on api_keys"
    ON public.api_keys
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Allow authenticated admins to manage API keys
CREATE POLICY "Admins can manage api_keys"
    ON public.api_keys
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'admin_limited')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE users.id = auth.uid()
            AND users.role IN ('admin', 'admin_limited')
        )
    );
