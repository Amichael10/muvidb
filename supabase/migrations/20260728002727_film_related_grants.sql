-- film_related was created without table-level GRANTs, so even the service_role
-- got "permission denied" (RLS narrows access, but the base SELECT/INSERT
-- privilege must still be granted to the role). Grant read to the API roles and
-- full access to service_role (the build job).
grant select on public.film_related to anon, authenticated;
grant all    on public.film_related to service_role;
