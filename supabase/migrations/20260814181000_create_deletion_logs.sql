-- Migration: 20260814181000_create_deletion_logs.sql
-- Description: Create deletion_logs table to track film, actor, credit, and channel deletions with 30-day auto-cleanup

CREATE TABLE IF NOT EXISTS public.deletion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'actor', 'film', 'credit', 'channel', etc.
    entity_id TEXT,
    entity_name TEXT NOT NULL,
    deleted_by TEXT DEFAULT 'system', -- 'Admin UI', 'cleanup_bad_stubs.ts', etc.
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.deletion_logs ENABLE ROW LEVEL SECURITY;

-- Grant permissions to roles
GRANT ALL ON public.deletion_logs TO anon, authenticated, service_role;

-- Allow authenticated admins, service role, and anon read/insert access
CREATE POLICY "deletion_logs_policy"
    ON public.deletion_logs FOR ALL
    USING (true)
    WITH CHECK (true);

-- Index for fast deletion history lookup & auto-cleanup queries
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON public.deletion_logs(deleted_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_entity_type ON public.deletion_logs(entity_type);

-- Function to prune deletion logs older than 30 days
CREATE OR REPLACE FUNCTION public.purge_old_deletion_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.deletion_logs
    WHERE deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
