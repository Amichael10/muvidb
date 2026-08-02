-- Table-level grants for the NFVCB review queue and the PG-13 backup.
--
-- RLS policies are not sufficient on their own: the service role still needs a
-- GRANT, and without one every write fails with 42501 "permission denied".
-- The first sync run hit exactly that and reported 286 rows queued while
-- writing none, because the upsert's error was not checked.
--
-- authenticated gets select only; the admin screens read the queue through RLS
-- (is_admin()), and writes go through the service role.

grant select, insert, update, delete on table public.nfvcb_pending_matches to service_role;
grant select on table public.nfvcb_pending_matches to authenticated;

grant select, insert, update, delete on table public.films_pg13_remap_backup to service_role;
grant select on table public.films_pg13_remap_backup to authenticated;

notify pgrst, 'reload schema';
