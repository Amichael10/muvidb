-- Migration: Create api_keys table for MuviDB Developer / Partner API
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    key_prefix TEXT NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'enterprise'
    scopes TEXT[] NOT NULL DEFAULT '{}', -- e.g. ARRAY['films:read', 'people:read', 'credits:read', 'boxoffice:read', 'reviews:read']
    rate_limit_per_min INT NOT NULL DEFAULT 60,
    usage_count BIGINT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

-- Index for fast lookup on every incoming API request
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys (key_hash) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys (is_active);

-- Enable RLS (Service Role bypasses RLS, public cannot read raw table)
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Allow read/write only to service role or authenticated admins
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'api_keys' AND policyname = 'Admins can manage api_keys'
    ) THEN
        CREATE POLICY "Admins can manage api_keys"
            ON public.api_keys
            FOR ALL
            TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.users
                    WHERE users.id = auth.uid()
                    AND users.role = 'admin'
                )
            );
    END IF;
END $$;
