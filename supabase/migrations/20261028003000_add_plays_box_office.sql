-- =============================================================================
-- 20261028003000_add_plays_box_office.sql
-- Add Box Office tracking, admissions, and tier metrics to public.plays
-- =============================================================================

ALTER TABLE public.plays 
ADD COLUMN IF NOT EXISTS box_office_domestic NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS box_office_tickets_sold INT,
ADD COLUMN IF NOT EXISTS box_office_currency VARCHAR(10) DEFAULT 'NGN',
ADD COLUMN IF NOT EXISTS box_office_source TEXT,
ADD COLUMN IF NOT EXISTS box_office_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS box_office_metrics JSONB;

CREATE INDEX IF NOT EXISTS idx_plays_box_office_domestic ON public.plays(box_office_domestic DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_plays_box_office_tickets ON public.plays(box_office_tickets_sold DESC NULLS LAST);
