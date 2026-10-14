-- Queue future credit changes from every ingestion path; no historical backfill.
CREATE TABLE IF NOT EXISTS public.whatsapp_movie_alert_queue (
  film_id uuid PRIMARY KEY REFERENCES public.films(id) ON DELETE CASCADE,
  queued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  last_error text
);
ALTER TABLE public.whatsapp_movie_alert_queue ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_credit_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.follows f JOIN public.users u ON u.id = f.user_id
    WHERE f.person_id = NEW.person_id AND f.notify_whatsapp IS NOT FALSE
      AND u.whatsapp_enabled AND u.whatsapp_phone IS NOT NULL
  ) THEN RETURN NEW; END IF;
  INSERT INTO public.whatsapp_movie_alert_queue (film_id)
  VALUES (NEW.film_id)
  ON CONFLICT (film_id) DO UPDATE SET queued_at = clock_timestamp(), available_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enqueue_whatsapp_credit_alert ON public.credits;
CREATE TRIGGER enqueue_whatsapp_credit_alert
AFTER INSERT OR UPDATE OF person_id, film_id ON public.credits
FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_credit_alert();

CREATE OR REPLACE FUNCTION public.enqueue_whatsapp_published_film()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.is_published OR NEW.is_in_cinemas) AND EXISTS (
    SELECT 1 FROM public.credits c JOIN public.follows f ON f.person_id = c.person_id
    JOIN public.users u ON u.id = f.user_id
    WHERE c.film_id = NEW.id AND f.notify_whatsapp IS NOT FALSE
      AND u.whatsapp_enabled AND u.whatsapp_phone IS NOT NULL
  ) THEN
    INSERT INTO public.whatsapp_movie_alert_queue (film_id)
    VALUES (NEW.id)
    ON CONFLICT (film_id) DO UPDATE SET queued_at = clock_timestamp(), available_at = now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enqueue_whatsapp_published_film ON public.films;
CREATE TRIGGER enqueue_whatsapp_published_film
AFTER UPDATE OF is_published, is_in_cinemas ON public.films
FOR EACH ROW EXECUTE FUNCTION public.enqueue_whatsapp_published_film();

-- Claim one film at a time so concurrent cron runs cannot send the same alert.
CREATE OR REPLACE FUNCTION public.claim_whatsapp_movie_alert()
RETURNS SETOF public.whatsapp_movie_alert_queue
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.whatsapp_movie_alert_queue q
  SET locked_until = now() + interval '10 minutes'
  WHERE q.film_id = (
    SELECT film_id FROM public.whatsapp_movie_alert_queue
    WHERE available_at <= now() AND (locked_until IS NULL OR locked_until < now())
    ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED
  ) RETURNING q.*;
$$;
REVOKE ALL ON FUNCTION public.claim_whatsapp_movie_alert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_movie_alert() TO service_role;
