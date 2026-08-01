-- ONLY run this after upgrading compute past Micro (Small/Medium).
-- On Micro, HNSW build + queries burn the Disk IO burst and throttle the DB.
-- Live search no longer needs this — it uses Cohere Rerank instead.
--
-- If a build is already stuck thrashing IO, cancel it first:
--   select pg_cancel_backend(pid)
--   from pg_stat_activity
--   where query ilike '%film_embeddings_hnsw%' and pid <> pg_backend_pid();
--
-- Then (on bigger compute), create the index and rebuild related:
--   npm run related:build

create index if not exists film_embeddings_hnsw_idx
  on public.film_embeddings
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);
