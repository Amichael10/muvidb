-- Job applications + private resume storage.

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_postings(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  introduction text not null,
  social_links text not null,
  portfolio_links text not null,
  content_idea text not null,
  location text not null,
  availability text not null,
  resume_path text,
  resume_filename text,
  resume_content_type text,
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'shortlisted', 'rejected', 'hired')),
  admin_notes text,
  created_at timestamptz not null default now()
);

create index if not exists job_applications_job_id_idx
  on public.job_applications (job_id, created_at desc);

create index if not exists job_applications_status_idx
  on public.job_applications (status, created_at desc);

alter table public.job_applications enable row level security;

-- Public cannot read applications. Inserts go through service-role API only.
drop policy if exists "job_applications_admin_all" on public.job_applications;
create policy "job_applications_admin_all"
  on public.job_applications
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, update, delete on public.job_applications to authenticated;

-- Private resumes bucket (not public — admins get signed URLs via API)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-resumes',
  'job-resumes',
  false,
  3145728,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- No anon storage policies — uploads use the service role in /api/job-apply.
drop policy if exists "job_resumes_admin_select" on storage.objects;
create policy "job_resumes_admin_select"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'job-resumes' and public.is_admin());

drop policy if exists "job_resumes_admin_delete" on storage.objects;
create policy "job_resumes_admin_delete"
  on storage.objects
  for delete
  to authenticated
  using (bucket_id = 'job-resumes' and public.is_admin());
