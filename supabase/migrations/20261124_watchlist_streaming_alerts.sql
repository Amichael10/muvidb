-- Automated Watchlist "Now Streaming" Alert Trigger
-- Zero-maintenance loop: whenever a film gains a streaming URL or YouTube watch URL
-- (or transitions out of coming_soon), every user who watchlisted it receives an alert.

CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  film_id UUID REFERENCES public.films(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'watchlist_streaming',
  title TEXT NOT NULL,
  body TEXT,
  action_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user_unread
  ON public.user_notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_notifications' AND policyname = 'Users read own notifications'
  ) THEN
    CREATE POLICY "Users read own notifications"
      ON public.user_notifications FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_notifications' AND policyname = 'Users update own notifications'
  ) THEN
    CREATE POLICY "Users update own notifications"
      ON public.user_notifications FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.notify_watchlist_now_streaming()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  had_stream BOOLEAN;
  has_stream BOOLEAN;
  platform_label TEXT;
BEGIN
  had_stream := (
    COALESCE(OLD.youtube_watch_url, '') <> ''
    OR COALESCE(OLD.streaming_links->>'netflix', '') <> ''
    OR COALESCE(OLD.streaming_links->>'prime_video', '') <> ''
    OR COALESCE(OLD.streaming_links->>'kava', '') <> ''
    OR COALESCE(OLD.streaming_links->>'circuits', '') <> ''
  );

  has_stream := (
    COALESCE(NEW.youtube_watch_url, '') <> ''
    OR COALESCE(NEW.streaming_links->>'netflix', '') <> ''
    OR COALESCE(NEW.streaming_links->>'prime_video', '') <> ''
    OR COALESCE(NEW.streaming_links->>'kava', '') <> ''
    OR COALESCE(NEW.streaming_links->>'circuits', '') <> ''
  );

  IF NOT COALESCE(NEW.coming_soon, FALSE) AND has_stream AND (NOT had_stream OR COALESCE(OLD.coming_soon, FALSE)) THEN
    platform_label := CASE
      WHEN COALESCE(NEW.streaming_links->>'netflix', '') <> '' THEN 'Netflix'
      WHEN COALESCE(NEW.streaming_links->>'prime_video', '') <> '' THEN 'Prime Video'
      WHEN COALESCE(NEW.youtube_watch_url, '') <> '' THEN 'YouTube'
      WHEN COALESCE(NEW.streaming_links->>'kava', '') <> '' THEN 'Kava'
      ELSE 'Streaming'
    END;

    INSERT INTO public.user_notifications (user_id, film_id, type, title, body, action_url)
    SELECT
      w.user_id,
      NEW.id,
      'watchlist_streaming',
      NEW.title || ' is now streaming on ' || platform_label,
      'A title from your watchlist is now available to watch online.',
      '/films/' || COALESCE(NEW.slug, NEW.id::text)
    FROM public.watchlist w
    WHERE w.film_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_watchlist_streaming ON public.films;
CREATE TRIGGER trg_notify_watchlist_streaming
  AFTER UPDATE OF youtube_watch_url, streaming_links, coming_soon
  ON public.films
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_watchlist_now_streaming();
