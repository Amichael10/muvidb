-- =============================================================================
-- FILM EMBEDDINGS (Cohere embed-v4 → pgvector)
-- =============================================================================
-- Stores title+synopsis vectors for semantic "More Like This" and search.
-- Built offline by scripts/embed_films.ts; read via match_* RPCs.
-- =============================================================================

create extension if not exists vector;

create table if not exists public.film_embeddings (
  film_id       uuid primary key references public.films(id) on delete cascade,
  embedding     vector(1536) not null,
  model         text not null default 'embed-v4.0',
  content_hash  text not null,
  updated_at    timestamptz not null default now()
);

create index if not exists film_embeddings_hnsw_idx
  on public.film_embeddings
  using hnsw (embedding vector_cosine_ops);

alter table public.film_embeddings enable row level security;

-- Public read of the table itself is unnecessary — clients use RPCs that join
-- to films. Keep the raw vectors service-role only.
drop policy if exists "film_embeddings service read" on public.film_embeddings;
-- No anon/authenticated policies → only service_role (bypasses RLS) can read/write.

comment on table public.film_embeddings is
  'Cohere title+synopsis embeddings for semantic related-films and search. '
  'Built by scripts/embed_films.ts.';

-- Nearest neighbours for a raw query vector (semantic search).
create or replace function public.match_films_by_embedding(
  query_embedding vector(1536),
  match_count int default 24,
  min_similarity real default 0.25
)
returns table (
  film_id uuid,
  similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e.film_id,
    (1 - (e.embedding <=> query_embedding))::real as similarity
  from public.film_embeddings e
  join public.films f on f.id = e.film_id
  where f.is_published is true
    and (1 - (e.embedding <=> query_embedding)) >= min_similarity
  order by e.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 24), 100));
$$;

-- Nearest neighbours for an existing film (related-films rebuild / live fallback).
create or replace function public.match_related_by_embedding(
  p_film_id uuid,
  match_count int default 40
)
returns table (
  film_id uuid,
  similarity real
)
language sql
stable
security definer
set search_path = public
as $$
  select
    e2.film_id,
    (1 - (e1.embedding <=> e2.embedding))::real as similarity
  from public.film_embeddings e1
  join public.film_embeddings e2 on e2.film_id <> e1.film_id
  join public.films f on f.id = e2.film_id
  where e1.film_id = p_film_id
    and f.is_published is true
  order by e1.embedding <=> e2.embedding
  limit greatest(1, least(coalesce(match_count, 40), 100));
$$;

grant execute on function public.match_films_by_embedding(vector, int, real) to anon, authenticated, service_role;
grant execute on function public.match_related_by_embedding(uuid, int) to anon, authenticated, service_role;
