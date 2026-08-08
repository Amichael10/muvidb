-- Let the community submit whole new records, not just edits to existing ones.
--
-- The contributions queue was built for corrections: you could suggest a
-- missing person, propose field edits on a person or film, or report a bad
-- link/channel. There was no way to say "this film is not in the catalogue at
-- all" or "here is a Nollywood YouTube channel you are not tracking", which is
-- most of what people actually write in about.
--
-- Two things block that today:
--
--   1. The `type` CHECK only allows the five original values, so an insert of
--      'new_film' or 'new_channel' is rejected outright at the database. The
--      constraint was declared inline in sql/contributions_system.sql, so
--      Postgres auto-named it — and on a database that has been re-run or
--      hand-patched the name is not guaranteed. The DO block below drops
--      whichever CHECK constraint on the table still mentions 'new_person',
--      by definition rather than by name, then adds the widened one back under
--      a known name.
--
--   2. The `contributions` table itself has never been under migration
--      control. It lives only in sql/contributions_system.sql and
--      sql/contributions_storage.sql, which are run by hand in the SQL editor,
--      so a fresh environment comes up without it. Everything here is
--      idempotent (create table if not exists / add column if not exists /
--      drop policy if exists) so it is safe against the deployed database,
--      where the table is already populated, while also being enough to stand
--      the table up from nothing.
--
-- Also adds the partial index the admin queue actually needs: it reads pending
-- rows newest-first and nothing else, and pending is a small slice of a table
-- that only grows.
--
-- Depends on public.is_admin() from sql/security_rls_hardening.sql.

create table if not exists public.contributions (
  id            uuid primary key default gen_random_uuid(),
  type          text not null,
  target_table  text,        -- 'people' | 'films' | 'channels' | 'youtube_channels'; null for new_* submissions
  target_id     uuid,        -- the row being edited/reported; null for new_* submissions
  payload       jsonb not null default '{}'::jsonb,  -- proposed fields / report details
  image_url     text,        -- legacy: submitted image URL
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  note          text,        -- submitter note, or admin rejection reason
  submitted_by  uuid references public.users(id) on delete set null,
  reviewed_by   uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz
);

-- Path of the quarantined upload in the private 'contributions' bucket.
-- Added by sql/contributions_storage.sql on the deployed database; repeated
-- here so a fresh environment is not missing it.
alter table public.contributions add column if not exists image_path text;

-- Widen the type vocabulary. Matched by definition, not by name, because the
-- original constraint was auto-named and may differ per environment.
do $$
declare
  con_name text;
begin
  for con_name in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace nsp on nsp.oid = rel.relnamespace
     where nsp.nspname = 'public'
       and rel.relname = 'contributions'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) like '%new_person%'
  loop
    execute format('alter table public.contributions drop constraint %I', con_name);
  end loop;
end
$$;

alter table public.contributions drop constraint if exists contributions_type_check;
alter table public.contributions
  add constraint contributions_type_check check (type in (
    'new_person',
    'new_film',
    'new_channel',
    'edit_person',
    'edit_film',
    'report_link',
    'report_channel'
  ));

comment on column public.contributions.type is
  'What was submitted. new_* creates a record on approval (target_id null); '
  'edit_* proposes field changes to target_table/target_id; report_* is a flag.';

create index if not exists idx_contributions_status    on public.contributions (status, created_at desc);
create index if not exists idx_contributions_submitter on public.contributions (submitted_by);
create index if not exists idx_contributions_target    on public.contributions (target_table, target_id);

-- The moderation queue only ever reads pending rows, newest first.
create index if not exists idx_contributions_pending
  on public.contributions (status, created_at desc)
  where status = 'pending';

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

-- Only admins can approve/reject. Submissions are immutable to their author.
drop policy if exists "contrib_update_admin" on public.contributions;
create policy "contrib_update_admin" on public.contributions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- RLS alone is not enough; without a GRANT every statement fails with 42501.
grant select, insert, update on table public.contributions to authenticated;
grant select, insert, update, delete on table public.contributions to service_role;

notify pgrst, 'reload schema';
