-- =============================================================================
-- FILMS PUBLISH GATE — is_published + read RLS
-- =============================================================================
-- Premium look = control what shows, not delete/clean everything. This adds a
-- publish flag and gates public reads through it. Nothing is hidden by the
-- migration itself (default true); a separate reviewed data step flips the pure
-- clickbait-junk rows to false.
--
-- Enforcement is a single RLS choke point so no public query can leak hidden
-- rows: anon/regular users see only is_published = true; admins see everything.
-- NOTE: the api/* endpoints use the service-role key, which BYPASSES RLS — those
-- are filtered separately in code (api/films.ts, api/seo.ts).
-- =============================================================================

alter table public.films
  add column if not exists is_published boolean not null default true;

-- Partial index: the hidden set is the minority we filter against on hot paths.
create index if not exists idx_films_unpublished on public.films (id) where is_published = false;

alter table public.films enable row level security;

-- Replace whatever open SELECT policy currently exists (its name predates the
-- repo's migrations) with the gated one. Dropping dynamically avoids guessing
-- the name; Postgres ORs permissive policies together, so a stray USING(true)
-- left behind would silently defeat the gate.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'films' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.films', pol.policyname);
  end loop;
end $$;

create policy "films_public_read" on public.films
  for select
  using (is_published or public.is_admin());
