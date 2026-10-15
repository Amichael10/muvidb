ALTER TABLE public.whatsapp_movie_alert_log
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_code integer,
  ADD COLUMN IF NOT EXISTS issue_notified_at timestamptz;
-- Existing accepted messages keep their original age for monitoring.
UPDATE public.whatsapp_movie_alert_log SET last_attempt_at = created_at;
CREATE INDEX IF NOT EXISTS whatsapp_alert_retry_idx ON public.whatsapp_movie_alert_log(next_retry_at)
  WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS whatsapp_alert_unconfirmed_idx ON public.whatsapp_movie_alert_log(last_attempt_at)
  WHERE status = 'sent';
ALTER TABLE public.whatsapp_movie_alert_queue ADD COLUMN IF NOT EXISTS issue_notified_at timestamptz;
