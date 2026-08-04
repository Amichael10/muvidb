-- Review queue for NFVCB approved-movie entries that could not be matched
-- confidently.
--
-- The Board publishes monthly lists of the films it has classified, with real
-- ratings and credits. Matching those official titles to our catalogue is the
-- hard part: official titles are ALL CAPS and clean, ours carry YouTube
-- headline noise, and short titles produce dangerous substring collisions
-- ("STRINGS" matches "Strings of Sweet Love", "IMA" matches an unrelated
-- talk-show upload).
--
-- Writing a government classification onto the wrong film is the failure that
-- matters here, so anything not confirmed by runtime lands here instead of
-- being applied.

create table if not exists public.nfvcb_pending_matches (
  id uuid primary key default gen_random_uuid(),
  source_month text not null,
  official_title text not null,
  rating text,
  runtime_minutes integer,
  language text,
  director text,
  producer text,
  major_cast text[] not null default '{}',
  production_company text,
  approved_on text,
  -- Best guess and why it was not applied automatically.
  candidate_film_id uuid references public.films(id) on delete set null,
  candidate_title text,
  reason text not null,
  status text not null default 'pending',
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_month, official_title)
);

alter table public.nfvcb_pending_matches enable row level security;

drop policy if exists nfvcb_pending_matches_admin_read on public.nfvcb_pending_matches;
create policy nfvcb_pending_matches_admin_read
  on public.nfvcb_pending_matches for select
  using (public.is_admin());

drop policy if exists nfvcb_pending_matches_admin_write on public.nfvcb_pending_matches;
create policy nfvcb_pending_matches_admin_write
  on public.nfvcb_pending_matches for update
  using (public.is_admin()) with check (public.is_admin());

create index if not exists nfvcb_pending_matches_status_idx
  on public.nfvcb_pending_matches (status, created_at desc)
  where status = 'pending';

-- Records which films carry an officially-sourced rating, so a later pass can
-- tell "the Board classified this" from "someone typed it in".
alter table public.films
  add column if not exists nfvcb_rating_source text,
  add column if not exists nfvcb_rating_verified_at timestamptz;

comment on column public.films.nfvcb_rating_source is
  'Where the classification came from, e.g. nfvcb_approved_movies. NULL means unverified/manual.';
