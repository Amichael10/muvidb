-- Migration: Multi-Channel Company Verification & Talent Pro Architecture
-- Enables Email/Instagram DM/Telegram verification for Studios, and Career Management for Actors.

-- 1. Extend company_claims with verification methods & codes
ALTER TABLE public.company_claims
  ADD COLUMN IF NOT EXISTS verification_method TEXT DEFAULT 'work_email',
  ADD COLUMN IF NOT EXISTS instagram_handle TEXT,
  ADD COLUMN IF NOT EXISTS claim_code TEXT,
  ADD COLUMN IF NOT EXISTS telegram_message_id TEXT,
  ADD COLUMN IF NOT EXISTS review_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_company_claims_claim_code ON public.company_claims(claim_code);

-- 2. Extend companies with verification metadata
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS verified_via TEXT,
  ADD COLUMN IF NOT EXISTS verification_code TEXT;

-- 3. Extend people table with Talent Pro Suite
ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_plan TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booking_email TEXT,
  ADD COLUMN IF NOT EXISTS booking_phone TEXT,
  ADD COLUMN IF NOT EXISTS booking_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS management_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_note TEXT,
  ADD COLUMN IF NOT EXISTS showreel_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS headshots JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS view_count_weekly INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count_total INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_people_is_pro ON public.people(is_pro);
CREATE INDEX IF NOT EXISTS idx_people_availability ON public.people(availability_status);
