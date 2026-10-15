CREATE TABLE IF NOT EXISTS public.payment_orders (
  reference text PRIMARY KEY,
  provider text NOT NULL CHECK (provider IN ('opay', 'bachs')),
  user_id uuid REFERENCES public.users(id),
  company_id uuid REFERENCES public.companies(id),
  plan_type text NOT NULL CHECK (plan_type IN ('pro_monthly', 'pro_annual', 'support')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL DEFAULT 'NGN' CHECK (currency = 'NGN'),
  sandbox boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  provider_checkout_id text,
  provider_transaction_id text,
  provider_event_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  UNIQUE(provider, provider_transaction_id),
  UNIQUE(provider, provider_event_id)
);
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_orders FROM anon, authenticated;
GRANT ALL ON public.payment_orders TO service_role;

CREATE OR REPLACE FUNCTION public.settle_payment_order(p_reference text, p_provider text, p_amount_minor bigint,
  p_currency text, p_transaction_id text, p_event_id text, p_checkout_id text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE v_order public.payment_orders%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service authentication required' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_order FROM public.payment_orders WHERE reference = p_reference AND provider = p_provider FOR UPDATE;
  IF NOT FOUND OR p_amount_minor IS DISTINCT FROM v_order.amount_minor OR p_currency IS DISTINCT FROM v_order.currency
    OR COALESCE(p_transaction_id, '') = '' OR COALESCE(p_event_id, '') = '' THEN RETURN false; END IF;
  IF p_provider = 'bachs' AND (p_checkout_id IS NULL OR p_checkout_id IS DISTINCT FROM v_order.provider_checkout_id) THEN RETURN false; END IF;
  IF v_order.status = 'paid' THEN RETURN v_order.provider_transaction_id = p_transaction_id; END IF;
  UPDATE public.payment_orders SET status = 'paid', provider_transaction_id = p_transaction_id,
    provider_event_id = p_event_id, paid_at = now() WHERE reference = p_reference;
  IF NOT v_order.sandbox AND v_order.company_id IS NOT NULL AND v_order.plan_type IN ('pro_monthly', 'pro_annual') THEN
    UPDATE public.companies SET api_tier = 'pro' WHERE id = v_order.company_id;
  END IF;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.settle_payment_order(text,text,bigint,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_order(text,text,bigint,text,text,text,text) TO service_role;
