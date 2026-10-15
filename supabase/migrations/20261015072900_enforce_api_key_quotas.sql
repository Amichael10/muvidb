-- Serialize requests per key so limits also hold across concurrent API instances.
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS quota_window_start timestamptz;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS quota_window_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.consume_api_key_quota(p_key_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_key public.api_keys%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authentication required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_key FROM public.api_keys WHERE id = p_key_id FOR UPDATE;
  IF NOT FOUND OR NOT v_key.is_active OR v_key.rate_limit_per_min <= 0 THEN RETURN false; END IF;
  IF v_key.quota_window_start IS NULL OR v_now >= v_key.quota_window_start + interval '1 minute' THEN
    v_key.quota_window_start := v_now;
    v_key.quota_window_count := 0;
  END IF;
  IF v_key.quota_window_count >= v_key.rate_limit_per_min THEN RETURN false; END IF;
  UPDATE public.api_keys SET quota_window_start = v_key.quota_window_start,
    quota_window_count = v_key.quota_window_count + 1,
    usage_count = usage_count + 1, last_used_at = v_now WHERE id = p_key_id;
  RETURN true;
END;
$function$;
REVOKE ALL ON FUNCTION public.consume_api_key_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_api_key_quota(uuid) TO service_role;
