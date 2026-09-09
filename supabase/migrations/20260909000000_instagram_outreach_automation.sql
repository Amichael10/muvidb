-- Instagram DM Outreach Automation Schema
-- Supports queueing, AI message personalization, execution logging, and admin moderation.

CREATE TABLE IF NOT EXISTS public.outreach_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  person_name text NOT NULL,
  instagram_handle text NOT NULL,
  instagram_url text NOT NULL,
  department text,
  film_count integer DEFAULT 0,
  highlight_films jsonb DEFAULT '[]'::jsonb,
  profile_url text,
  claim_url text,
  generated_message text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'approved', 'sent', 'cancelled', 'failed', 'replied')),
  scheduled_for timestamptz DEFAULT now(),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outreach_queue_person_unique UNIQUE (person_id)
);

CREATE INDEX IF NOT EXISTS outreach_queue_status_idx ON public.outreach_queue (status);
CREATE INDEX IF NOT EXISTS outreach_queue_scheduled_idx ON public.outreach_queue (scheduled_for);

CREATE TABLE IF NOT EXISTS public.outreach_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_id uuid REFERENCES public.outreach_queue(id) ON DELETE SET NULL,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  person_name text,
  instagram_handle text,
  message text,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'cancelled', 'replied')),
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS outreach_logs_sent_at_idx ON public.outreach_logs (sent_at DESC);

ALTER TABLE public.outreach_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage outreach_queue" ON public.outreach_queue;
CREATE POLICY "Admins manage outreach_queue"
  ON public.outreach_queue
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins manage outreach_logs" ON public.outreach_logs;
CREATE POLICY "Admins manage outreach_logs"
  ON public.outreach_logs
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
