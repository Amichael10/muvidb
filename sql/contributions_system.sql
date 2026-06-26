-- =============================================================================
-- COMMUNITY CONTRIBUTIONS SYSTEM
-- =============================================================================
-- One unified moderation queue for all crowd-sourced input:
--   * new_person     — suggest a missing actor/crew member
--   * edit_person     — suggest corrections/additions to a person
--   * edit_film       — suggest corrections/additions to a film
--   * report_link     — report a broken / pirate watch link
--   * report_channel  — report a problematic YouTube channel
--
-- Nothing here writes to live content tables — submissions sit as 'pending'
-- until an admin approves, at which point the AdminContributions screen applies
-- the change (using admin RLS). Depends on is_admin() from
-- sql/security_rls_hardening.sql. Safe to re-run.
--
-- Run once in the Supabase SQL editor.
-- =============================================================================

create table if not exists public.contributions (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in (
                  'new_person','edit_person','edit_film','report_link','report_channel')),
  target_table  text,        -- e.g. 'people' | 'films' | 'youtube_channels'; null for new_person
  target_id     uuid,        -- the row being edited/reported; null for new_person
  payload       jsonb not null default '{}'::jsonb,  -- proposed fields / report details
  image_url     text,        -- optional submitted image URL (mirrored on approval)
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  note          text,        -- submitter note, or admin rejection reason
  submitted_by  uuid references public.users(id) on delete set null,
  reviewed_by   uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

create index if not exists idx_contributions_status    on public.contributions (status, created_at desc);
create index if not exists idx_contributions_submitter on public.contributions (submitted_by);
create index if not exists idx_contributions_target    on public.contributions (target_table, target_id);

alter table public.contributions enable row level security;

-- Submit: any signed-in user, only as themselves.
drop policy if exists "contrib_insert_own" on public.contributions;
create policy "contrib_insert_own" on public.contributions
  for insert to authenticated
  with check (submitted_by = auth.uid());

-- Submitters can see the status of their own submissions.
drop policy if exists "contrib_select_own" on public.contributions;
create policy "contrib_select_own" on public.contributions
  for select to authenticated
  using (submitted_by = auth.uid());

-- Admins can see everything.
drop policy if exists "contrib_select_admin" on public.contributions;
create policy "contrib_select_admin" on public.contributions
  for select to authenticated
  using (public.is_admin());

-- Only admins can approve/reject (update). Submissions are immutable to their author.
drop policy if exists "contrib_update_admin" on public.contributions;
create policy "contrib_update_admin" on public.contributions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
