-- Table-level grants for film_embeddings (RLS bypass still needs GRANT).
grant select, insert, update, delete on table public.film_embeddings to service_role;

-- Ensure PostgREST can see the new RPCs after migrate.
notify pgrst, 'reload schema';
