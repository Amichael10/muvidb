-- Migration: Talent Private Contacts & Admin Outreach Store
-- Keeps private phone numbers and personal emails strictly restricted to Admins (0% public exposure).

CREATE TABLE IF NOT EXISTS public.talent_private_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  source TEXT DEFAULT 'del_york_alumni',
  notes TEXT,
  raw_metadata JSONB DEFAULT '{}'::jsonb,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT talent_private_contacts_person_unique UNIQUE (person_id)
);

CREATE INDEX IF NOT EXISTS idx_talent_private_contacts_person ON public.talent_private_contacts(person_id);
CREATE INDEX IF NOT EXISTS idx_talent_private_contacts_email ON public.talent_private_contacts(email);
CREATE INDEX IF NOT EXISTS idx_talent_private_contacts_phone ON public.talent_private_contacts(phone);

-- Enforce Strict Admin-Only Row Level Security
ALTER TABLE public.talent_private_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage talent private contacts" ON public.talent_private_contacts;
CREATE POLICY "Admins can manage talent private contacts"
  ON public.talent_private_contacts FOR ALL TO authenticated
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited'))
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'admin_limited'));

-- Service Role has full maintenance permissions
GRANT ALL ON TABLE public.talent_private_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.talent_private_contacts TO authenticated;

COMMENT ON TABLE public.talent_private_contacts IS
  'Private phone numbers and personal emails for talents, accessible strictly to admin users for talent outreach.';
