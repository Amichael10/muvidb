-- =============================================================================
-- PRECOMPUTED "MORE LIKE THIS"  (film_related)
-- =============================================================================
-- The live related-films query on FilmDetail was genre-only, and 62% of the
-- catalogue is tagged "Drama", so it degraded to near-random — and its empty-
-- genre fallback literally pulled 12 arbitrary rows. It also ran multiple
-- queries against a slow DB (8-15s under load) on every film view.
--
-- This table holds a precomputed top-N related list per film, built offline by
-- scripts/build_related_films.ts with a weighted blend (shared cast/crew >
-- rarity-weighted genre > shared minority language > same series > recency, with
-- popularity as tiebreak). FilmDetail reads it in ONE indexed query.
--
-- `reason` is a short human label for the strongest signal ("More with Odunlade
-- Adekola", "More Yoruba drama") so the rail can explain itself.
-- =============================================================================

create table if not exists public.film_related (
  film_id     uuid not null references public.films(id) on delete cascade,
  related_id  uuid not null references public.films(id) on delete cascade,
  rank        smallint not null,          -- 0 = best; ordering within a film
  score       real not null,
  reason      text,                        -- e.g. 'More with Odunlade Adekola'
  computed_at timestamptz not null default now(),
  primary key (film_id, related_id),
  check (film_id <> related_id)
);

-- Primary read path: given a film, fetch its related in rank order.
create index if not exists film_related_lookup_idx
  on public.film_related (film_id, rank);

alter table public.film_related enable row level security;

-- Public read (it only exposes already-public film relationships); writes are
-- service-role only (the build job), which bypasses RLS. No authenticated-user
-- write policy on purpose — nothing but the job should populate this.
drop policy if exists "film_related public read" on public.film_related;
create policy "film_related public read"
  on public.film_related for select
  to anon, authenticated
  using (true);

comment on table public.film_related is
  'Precomputed More-Like-This per film. Built by scripts/build_related_films.ts; '
  'read by FilmDetail. Never written from the client.';
