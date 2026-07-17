-- Keep the homepage Coming Soon query fast as the films catalogue grows.
CREATE INDEX IF NOT EXISTS idx_films_status_release_date
  ON public.films (status, release_date);
