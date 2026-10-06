-- Migration: Company Pro, Membership, and Dashboard Schema
-- Supports Company claiming, team membership, talent roster, and movie catalogue management.

-- 1. Extend companies table with verification, branding, contacts, and API access
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS booking_url TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS api_key TEXT,
  ADD COLUMN IF NOT EXISTS api_tier TEXT DEFAULT 'free';

-- 2. Create company_members table for team collaboration
CREATE TABLE IF NOT EXISTS public.company_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'editor')),
  title TEXT, -- e.g. "Head of Production", "Managing Director", "PR Lead"
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_company ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_company_members_user ON public.company_members(user_id);

-- 3. Create company_claims table for official verification requests
CREATE TABLE IF NOT EXISTS public.company_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_email TEXT NOT NULL,
  official_role TEXT NOT NULL,
  verification_doc_url TEXT,
  website_or_social TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_claims_company ON public.company_claims(company_id);
CREATE INDEX IF NOT EXISTS idx_company_claims_user ON public.company_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_company_claims_status ON public.company_claims(status);

-- 4. Helper Security Definer Functions
CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = p_user_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_admin_or_owner(p_company_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id
      AND user_id = p_user_id
      AND status = 'active'
      AND role IN ('owner', 'admin')
  );
$$;

-- 5. Row Level Security Setup
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_claims ENABLE ROW LEVEL SECURITY;

-- company_members policies
DROP POLICY IF EXISTS "Public can view active company members" ON public.company_members;
CREATE POLICY "Public can view active company members"
  ON public.company_members FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Members can view all members of their company" ON public.company_members;
CREATE POLICY "Members can view all members of their company"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_company_member(company_id, auth.uid())
    OR (auth.jwt() ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can manage company members" ON public.company_members;
CREATE POLICY "Admins can manage company members"
  ON public.company_members FOR ALL
  TO authenticated
  USING (
    public.is_company_admin_or_owner(company_id, auth.uid())
    OR (auth.jwt() ->> 'role') = 'admin'
  )
  WITH CHECK (
    public.is_company_admin_or_owner(company_id, auth.uid())
    OR (auth.jwt() ->> 'role') = 'admin'
  );

-- company_claims policies
DROP POLICY IF EXISTS "Users can view their own company claims" ON public.company_claims;
CREATE POLICY "Users can view their own company claims"
  ON public.company_claims FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt() ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Users can submit company claims" ON public.company_claims;
CREATE POLICY "Users can submit company claims"
  ON public.company_claims FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update company claims" ON public.company_claims;
CREATE POLICY "Admins can update company claims"
  ON public.company_claims FOR UPDATE
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- Allow company members to update their own company profile
DROP POLICY IF EXISTS "Company members can update company profile" ON public.companies;
CREATE POLICY "Company members can update company profile"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    public.is_company_member(id, auth.uid())
    OR (auth.jwt() ->> 'role') = 'admin'
  )
  WITH CHECK (
    public.is_company_member(id, auth.uid())
    OR (auth.jwt() ->> 'role') = 'admin'
  );

-- 6. Claim Approval Function
CREATE OR REPLACE FUNCTION public.approve_company_claim(p_claim_id UUID, p_reviewer_id UUID DEFAULT auth.uid())
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim RECORD;
  v_company RECORD;
BEGIN
  -- 1. Fetch claim
  SELECT * INTO v_claim FROM public.company_claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company claim % not found', p_claim_id;
  END IF;

  IF v_claim.status = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Claim is already approved');
  END IF;

  -- 2. Fetch company
  SELECT * INTO v_company FROM public.companies WHERE id = v_claim.company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Associated company % not found', v_claim.company_id;
  END IF;

  -- 3. Update claim status
  UPDATE public.company_claims
  SET status = 'approved',
      reviewed_by = p_reviewer_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_claim_id;

  -- 4. Mark company as claimed & verified
  UPDATE public.companies
  SET claimed = true,
      verified = true,
      claimed_by = v_claim.user_id,
      claimed_at = NOW(),
      contact_email = COALESCE(contact_email, v_claim.work_email),
      api_key = COALESCE(api_key, 'mvd_live_' || encode(gen_random_bytes(16), 'hex')),
      api_tier = 'pro',
      updated_at = NOW()
  WHERE id = v_claim.company_id;

  -- 5. Add user as 'owner' in company_members
  INSERT INTO public.company_members (company_id, user_id, role, title, status)
  VALUES (v_claim.company_id, v_claim.user_id, 'owner', v_claim.official_role, 'active')
  ON CONFLICT (company_id, user_id)
  DO UPDATE SET
    role = 'owner',
    title = EXCLUDED.title,
    status = 'active',
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'company_id', v_claim.company_id,
    'company_name', v_company.name,
    'user_id', v_claim.user_id
  );
END;
$$;

-- Grant permissions to standard Supabase roles
GRANT ALL ON public.company_members TO anon, authenticated, service_role;
GRANT ALL ON public.company_claims TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_member TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_company_admin_or_owner TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_company_claim TO authenticated, service_role;
