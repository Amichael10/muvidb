-- =============================================================================
-- FUZZY PERSON SUGGESTIONS
-- =============================================================================
-- find_person_by_name() is deliberately strict — exact fold, then name_key
-- (order-insensitive), no fuzzy matching — so it never silently merges two
-- different people. That is correct for *auto-linking*, but it means a near-miss
-- like "Bayo Adeniyi" vs "Adebayo Adeniyi", or "Sola" vs "Shola", produces a new
-- person with no hint that a similar one already exists.
--
-- This adds a separate, non-authoritative SUGGESTION path. It never links
-- anything; it only returns candidates ranked by similarity so the UI can offer
-- "did you mean…?" before a new person is created.
--
-- Note the existing substring search only catches variants by luck (it finds
-- "Adebayo" from "bayo" because that happens to be a substring). Trigram
-- similarity catches the cases substring cannot.
-- =============================================================================

-- Supabase installs extensions into the `extensions` schema, not `public`, so
-- the operator class and the similarity()/% operators must be schema-qualified
-- (or reachable via search_path) — an unqualified gin_trgm_ops fails with
-- "operator class does not exist for access method gin".
create extension if not exists pg_trgm with schema extensions;

-- Trigram index on the folded name so similarity search stays fast.
create index if not exists people_name_trgm_idx
  on public.people using gin (lower(name) extensions.gin_trgm_ops);

create or replace function public.suggest_similar_people(
  p_name  text,
  p_limit int default 8
)
returns table (
  id         uuid,
  name       text,
  slug       text,
  photo_url  text,
  film_count integer,
  score      real
)
language sql
stable
security definer
-- `extensions` on the path so similarity() and the % operator resolve.
set search_path = public, extensions
as $$
  with q as (
    select lower(coalesce(p_name, '')) as n,
           public.person_name_key(p_name) as k
  )
  select p.id,
         p.name,
         p.slug,
         p.photo_url,
         p.film_count,
         -- Exact name_key (order-insensitive) is a certainty, not a guess, so it
         -- outranks any trigram score.
         case when q.k is not null and p.name_key = q.k
              then 1.0::real
              else similarity(lower(p.name), q.n)
         end as score
  from public.people p, q
  where q.n <> ''
    and (
      lower(p.name) % q.n                      -- trigram-similar
      or (q.k is not null and p.name_key = q.k) -- same tokens, any order
    )
  order by score desc, p.film_count desc nulls last, p.name
  limit greatest(1, least(coalesce(p_limit, 8), 50));
$$;

comment on function public.suggest_similar_people(text, int) is
  'Non-authoritative "did you mean" candidates for a person name. Never links or '
  'merges — use find_person_by_name() for authoritative matching.';

grant execute on function public.suggest_similar_people(text, int) to anon, authenticated;
