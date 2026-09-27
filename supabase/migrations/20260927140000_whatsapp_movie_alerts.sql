-- Add WhatsApp notification fields to users and follows, plus create deduplicated movie alert log

-- 1. Add whatsapp_phone and whatsapp_enabled to users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS whatsapp_phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_enabled boolean NOT NULL DEFAULT true;

-- 2. Add notify_whatsapp preference to follows
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT true;

-- 3. Create the deduplicated movie alert log table
CREATE TABLE IF NOT EXISTS public.whatsapp_movie_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  phone text NOT NULL,
  followed_people_names text[] NOT NULL DEFAULT '{}',
  message_id text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_whatsapp_movie_alert_log_user_film UNIQUE (user_id, film_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_movie_alert_log_user_film
  ON public.whatsapp_movie_alert_log (user_id, film_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_movie_alert_log_created_at
  ON public.whatsapp_movie_alert_log (created_at DESC);

-- Enable RLS on whatsapp_movie_alert_log
ALTER TABLE public.whatsapp_movie_alert_log ENABLE ROW LEVEL SECURITY;

-- Admins and service role can read/manage all; users can read their own logs
DROP POLICY IF EXISTS "Users can read own whatsapp alerts" ON public.whatsapp_movie_alert_log;
CREATE POLICY "Users can read own whatsapp alerts" ON public.whatsapp_movie_alert_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
