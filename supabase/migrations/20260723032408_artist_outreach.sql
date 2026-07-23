-- Artist Instagram outreach queue (manual send desk).
-- Status lives here so we don't pollute people with campaign fields.

CREATE TABLE IF NOT EXISTS public.artist_outreach (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'queued', 'sent', 'replied', 'skipped')),
  notes text,
  last_message text,
  contacted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT artist_outreach_person_unique UNIQUE (person_id)
);

CREATE INDEX IF NOT EXISTS artist_outreach_status_idx
  ON public.artist_outreach (status);

CREATE INDEX IF NOT EXISTS artist_outreach_contacted_at_idx
  ON public.artist_outreach (contacted_at DESC NULLS LAST);

ALTER TABLE public.artist_outreach ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage artist outreach" ON public.artist_outreach;
CREATE POLICY "Admins manage artist outreach"
  ON public.artist_outreach
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMENT ON TABLE public.artist_outreach IS
  'Manual Instagram outreach desk for people with instagram_url. No auto-send.';
