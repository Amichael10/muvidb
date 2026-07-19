-- Make cinema triage visible to super admins and preserve unmatched schedules
-- until a title is either approved or rejected.

ALTER TABLE public.pending_cinema_films ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can read cinema triage" ON public.pending_cinema_films;
DROP POLICY IF EXISTS "Super admins can update cinema triage" ON public.pending_cinema_films;

CREATE POLICY "Super admins can read cinema triage"
  ON public.pending_cinema_films
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

CREATE POLICY "Super admins can update cinema triage"
  ON public.pending_cinema_films
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() = 'admin')
  WITH CHECK (public.get_my_role() = 'admin');

GRANT SELECT, UPDATE ON public.pending_cinema_films TO authenticated;

CREATE TABLE IF NOT EXISTS public.pending_cinema_showtimes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_film_id uuid NOT NULL REFERENCES public.pending_cinema_films(id) ON DELETE CASCADE,
  cinema_id uuid NOT NULL REFERENCES public.cinemas(id) ON DELETE CASCADE,
  show_date date NOT NULL,
  show_time time without time zone NOT NULL,
  format text NOT NULL DEFAULT 'Standard',
  screen_name text,
  ticket_url text,
  price numeric,
  source text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_cinema_showtimes_unique
    UNIQUE (pending_film_id, cinema_id, show_date, show_time, format)
);

CREATE INDEX IF NOT EXISTS pending_cinema_showtimes_pending_idx
  ON public.pending_cinema_showtimes (pending_film_id);

CREATE INDEX IF NOT EXISTS pending_cinema_showtimes_date_idx
  ON public.pending_cinema_showtimes (show_date, show_time);

ALTER TABLE public.pending_cinema_showtimes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can read pending cinema showtimes" ON public.pending_cinema_showtimes;

CREATE POLICY "Super admins can read pending cinema showtimes"
  ON public.pending_cinema_showtimes
  FOR SELECT
  TO authenticated
  USING (public.get_my_role() = 'admin');

GRANT SELECT ON public.pending_cinema_showtimes TO authenticated;

CREATE OR REPLACE FUNCTION public.promote_pending_cinema_film(
  p_pending_id uuid,
  p_existing_film_id uuid DEFAULT NULL,
  p_film_data jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.pending_cinema_films%ROWTYPE;
  v_film_id uuid;
  v_genres text[];
  v_has_future_showtimes boolean;
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'Only super admins can approve cinema films'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_pending
  FROM public.pending_cinema_films
  WHERE id = p_pending_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pending cinema film was not found';
  END IF;

  IF v_pending.admin_decision = 'blacklisted' THEN
    RAISE EXCEPTION 'Blacklisted cinema films cannot be promoted';
  END IF;

  IF v_pending.admin_decision = 'promoted' AND v_pending.promoted_film_id IS NOT NULL THEN
    RETURN v_pending.promoted_film_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.pending_cinema_showtimes
    WHERE pending_film_id = p_pending_id
      AND (
        show_date > (now() AT TIME ZONE 'Africa/Lagos')::date
        OR (
          show_date = (now() AT TIME ZONE 'Africa/Lagos')::date
          AND show_time >= (now() AT TIME ZONE 'Africa/Lagos')::time
        )
      )
  ) INTO v_has_future_showtimes;

  IF p_existing_film_id IS NOT NULL THEN
    SELECT id INTO v_film_id
    FROM public.films
    WHERE id = p_existing_film_id;

    IF v_film_id IS NULL THEN
      RAISE EXCEPTION 'The selected catalog film was not found';
    END IF;

    UPDATE public.films
    SET is_nollywood = true,
        is_in_cinemas = COALESCE(is_in_cinemas, false) OR v_has_future_showtimes,
        coming_soon = false,
        status = 'released',
        updated_at = now()
    WHERE id = v_film_id;
  ELSE
    IF jsonb_typeof(p_film_data -> 'genres') = 'array' THEN
      SELECT array_agg(value)
      INTO v_genres
      FROM jsonb_array_elements_text(p_film_data -> 'genres') AS value;
    END IF;

    INSERT INTO public.films (
      title,
      year,
      synopsis,
      poster_url,
      runtime_minutes,
      genres,
      language,
      status,
      release_type,
      source,
      is_nollywood,
      is_in_cinemas,
      coming_soon,
      needs_review,
      is_published
    ) VALUES (
      COALESCE(NULLIF(btrim(p_film_data ->> 'title'), ''), v_pending.title),
      NULLIF(p_film_data ->> 'year', '')::integer,
      COALESCE(NULLIF(p_film_data ->> 'synopsis', ''), v_pending.synopsis),
      COALESCE(NULLIF(p_film_data ->> 'poster_url', ''), v_pending.poster_url),
      COALESCE(NULLIF(p_film_data ->> 'runtime_minutes', '')::integer, v_pending.runtime_minutes),
      v_genres,
      COALESCE(NULLIF(p_film_data ->> 'language', ''), 'English'),
      'released',
      'cinema',
      'cinema-promoted',
      true,
      v_has_future_showtimes,
      false,
      true,
      true
    )
    RETURNING id INTO v_film_id;
  END IF;

  INSERT INTO public.showtimes (
    cinema_id,
    film_id,
    show_date,
    show_time,
    format,
    screen_name,
    ticket_url,
    price,
    source,
    is_available,
    last_seen_at
  )
  SELECT
    cinema_id,
    v_film_id,
    show_date,
    show_time,
    format,
    screen_name,
    ticket_url,
    price,
    source,
    true,
    last_seen_at
  FROM public.pending_cinema_showtimes
  WHERE pending_film_id = p_pending_id
    AND (
      show_date > (now() AT TIME ZONE 'Africa/Lagos')::date
      OR (
        show_date = (now() AT TIME ZONE 'Africa/Lagos')::date
        AND show_time >= (now() AT TIME ZONE 'Africa/Lagos')::time
      )
    )
  ON CONFLICT (cinema_id, film_id, show_date, show_time, format)
  DO UPDATE SET
    screen_name = EXCLUDED.screen_name,
    ticket_url = EXCLUDED.ticket_url,
    price = EXCLUDED.price,
    source = EXCLUDED.source,
    is_available = true,
    last_seen_at = EXCLUDED.last_seen_at;

  UPDATE public.pending_cinema_films
  SET admin_decision = 'promoted',
      promoted_film_id = v_film_id
  WHERE id = p_pending_id;

  RETURN v_film_id;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_pending_cinema_film(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promote_pending_cinema_film(uuid, uuid, jsonb) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'pending_cinema_films'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_cinema_films;
  END IF;
END
$$;
