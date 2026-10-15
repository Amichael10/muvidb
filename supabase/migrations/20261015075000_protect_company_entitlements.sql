-- Members may edit company profile details, but cannot grant paid access,
-- claim ownership, verification, or create public plaintext credentials.
ALTER TABLE public.companies ADD CONSTRAINT companies_no_plaintext_api_key CHECK (api_key IS NULL) NOT VALID;
ALTER TABLE public.companies VALIDATE CONSTRAINT companies_no_plaintext_api_key;
CREATE OR REPLACE FUNCTION public.protect_company_entitlements()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
BEGIN
  IF NEW.api_key IS NOT NULL THEN
    RAISE EXCEPTION 'Use the hashed API key management service' USING ERRCODE = '42501';
  END IF;
  IF auth.role() = 'service_role' OR EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role::text = 'admin'
  ) THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.api_tier, 'free') <> 'free' OR COALESCE(NEW.verified, false)
      OR COALESCE(NEW.claimed, false) OR NEW.claimed_by IS NOT NULL OR NEW.claimed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Company entitlement changes require administrator approval' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.api_tier IS DISTINCT FROM OLD.api_tier
    OR NEW.verified IS DISTINCT FROM OLD.verified
    OR NEW.claimed IS DISTINCT FROM OLD.claimed
    OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
    OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
    RAISE EXCEPTION 'Company entitlement changes require administrator approval' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.protect_company_entitlements() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_company_entitlements ON public.companies;
CREATE TRIGGER protect_company_entitlements BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.protect_company_entitlements();
