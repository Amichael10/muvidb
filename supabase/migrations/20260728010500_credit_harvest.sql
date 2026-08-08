-- =============================================================================
-- CREDIT HARVESTING (YouTube credit-roll OCR pipeline)
-- =============================================================================
-- Nollywood YouTube films don't exist on IMDB, and their descriptions are
-- hashtag spam (measured: 0% carry cast markers), so the credit roll at the end
-- of the video is the only reliable source of full cast/crew.
--
-- Two tables:
--   credit_harvest_jobs       the work queue — one row per film to process
--   credit_candidates         extracted names AWAITING REVIEW (never auto-live)
--
-- The worker (scripts/harvest_credits.ts) runs headless on a spare machine:
-- yt-dlp pulls only the tail of the video at low res, ffmpeg locates the credit
-- roll, local OCR reads it. Nothing here is written into `credits` until a human
-- approves it in the admin UI — extraction guesses, people decide.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- WORK QUEUE
-- ---------------------------------------------------------------------------
create table if not exists public.credit_harvest_jobs (
  id           uuid primary key default gen_random_uuid(),
  film_id      uuid not null references public.films(id) on delete cascade,
  -- Denormalised at enqueue time (films have no channel_id; the link is via
  -- channel_videos). Lets us compute per-channel priors with a simple GROUP BY.
  channel_id   uuid,
  status       text not null default 'pending'
               check (status in ('pending','running','done','failed','skipped')),
  -- What the worker concluded. 'no_credits' is a first-class OUTCOME, not a
  -- failure: many films genuinely have no credit roll, and recording that stops
  -- the pipeline from guessing names off end-of-video adverts forever.
  outcome      text check (outcome in ('credits_found','no_credits','unavailable','error')),
  priority     integer not null default 0,   -- higher first (seeded from view_count)
  attempts     smallint not null default 0,
  -- Where the roll was found, as a fraction of runtime. Feeds channel priors so
  -- later films from the same channel can seek straight to the right window.
  roll_start_pct real,
  roll_end_pct   real,
  candidates_found smallint not null default 0,
  error        text,
  started_at   timestamptz,
  processed_at timestamptz,
  created_at   timestamptz not null default now(),
  unique (film_id)
);

-- Claim query: highest priority pending job.
create index if not exists credit_harvest_jobs_claim_idx
  on public.credit_harvest_jobs (status, priority desc, created_at)
  where status = 'pending';
create index if not exists credit_harvest_jobs_channel_idx
  on public.credit_harvest_jobs (channel_id, outcome);

-- ---------------------------------------------------------------------------
-- CANDIDATES (pending review)
-- ---------------------------------------------------------------------------
create table if not exists public.credit_candidates (
  id            uuid primary key default gen_random_uuid(),
  film_id       uuid not null references public.films(id) on delete cascade,
  job_id        uuid references public.credit_harvest_jobs(id) on delete set null,
  raw_name      text not null,              -- exactly as OCR read it
  role_or_character text,
  credit_type   text not null default 'cast' check (credit_type in ('cast','crew')),
  -- 0..1. Structural quality of the roll + whether the name resolved to an
  -- existing person. The admin UI sorts and bulk-approves on this.
  confidence    real not null default 0,
  -- Resolved via find_person_by_name / suggest_similar_people at harvest time.
  matched_person_id uuid references public.people(id) on delete set null,
  status        text not null default 'pending'
                check (status in ('pending','approved','rejected')),
  source_frame_sec real,
  reviewed_at   timestamptz,
  reviewed_by   uuid,
  created_at    timestamptz not null default now()
);

create index if not exists credit_candidates_review_idx
  on public.credit_candidates (status, confidence desc);
create index if not exists credit_candidates_film_idx
  on public.credit_candidates (film_id, status);

-- ---------------------------------------------------------------------------
-- RLS + GRANTS
-- ---------------------------------------------------------------------------
-- NB: table-level GRANTs are required in addition to RLS — a new table with RLS
-- but no GRANT returns 42501 even for service_role (learned the hard way on
-- film_related).
alter table public.credit_harvest_jobs enable row level security;
alter table public.credit_candidates  enable row level security;

-- Admin-only: this is internal pipeline data, never public.
drop policy if exists "credit_harvest_jobs admin" on public.credit_harvest_jobs;
create policy "credit_harvest_jobs admin" on public.credit_harvest_jobs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "credit_candidates admin" on public.credit_candidates;
create policy "credit_candidates admin" on public.credit_candidates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.credit_harvest_jobs to authenticated;
grant select, insert, update, delete on public.credit_candidates  to authenticated;
grant all on public.credit_harvest_jobs to service_role;
grant all on public.credit_candidates  to service_role;

comment on table public.credit_harvest_jobs is
  'Work queue for the YouTube credit-roll OCR worker (scripts/harvest_credits.ts).';
comment on table public.credit_candidates is
  'Extracted cast/crew awaiting human approval. Nothing here is live until an '
  'admin approves it into the credits table.';
