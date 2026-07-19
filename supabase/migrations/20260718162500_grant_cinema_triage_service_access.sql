-- Scheduled cinema syncs use the service role and need explicit table grants.
GRANT ALL ON public.pending_cinema_showtimes TO service_role;
GRANT ALL ON public.pending_cinema_films TO service_role;
