CREATE TABLE IF NOT EXISTS public.request_quota_windows (
  subject text NOT NULL,
  window_start timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  requests integer NOT NULL DEFAULT 0,
  PRIMARY KEY (subject, window_start)
);
ALTER TABLE public.request_quota_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.request_quota_windows FROM anon, authenticated;
GRANT ALL ON public.request_quota_windows TO service_role;
CREATE INDEX IF NOT EXISTS request_quota_expiry_idx ON public.request_quota_windows(expires_at);

CREATE OR REPLACE FUNCTION public.consume_request_quota(p_subject text, p_limit integer, p_window_seconds integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
DECLARE
  v_start timestamptz;
  v_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authentication required' USING ERRCODE = '42501';
  END IF;
  IF length(p_subject) > 150 OR p_limit < 1 OR p_limit > 10000 OR p_window_seconds < 60 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid quota parameters';
  END IF;
  v_start := to_timestamp(floor(extract(epoch FROM clock_timestamp()) / p_window_seconds) * p_window_seconds);
  DELETE FROM public.request_quota_windows WHERE expires_at < clock_timestamp();
  INSERT INTO public.request_quota_windows(subject, window_start, expires_at, requests)
  VALUES (p_subject, v_start, v_start + make_interval(secs => p_window_seconds), 1)
  ON CONFLICT(subject, window_start) DO UPDATE SET requests = request_quota_windows.requests + 1
    WHERE request_quota_windows.requests < p_limit
  RETURNING requests INTO v_count;
  RETURN v_count IS NOT NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.consume_request_quota(text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_request_quota(text,integer,integer) TO service_role;
