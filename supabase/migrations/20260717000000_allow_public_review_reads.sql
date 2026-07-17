-- Reviews are visible on public film pages; write access remains user-scoped.
grant select on table public.reviews to anon, authenticated;
