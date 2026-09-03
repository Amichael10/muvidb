-- Operational state for destination-level review and Content Engine observability.
create table if not exists public.content_channel_approvals (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid not null references public.social_content_items(id) on delete cascade,
  destination_id uuid not null references public.content_destinations(id) on delete cascade,
  platform text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','blocked','published')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_item_id, destination_id, platform)
);

create index if not exists content_channel_approvals_status_idx
  on public.content_channel_approvals(destination_id, status, updated_at desc);

create table if not exists public.content_engine_activity_logs (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references public.social_content_items(id) on delete set null,
  destination_id uuid references public.content_destinations(id) on delete set null,
  platform text,
  event_type text not null,
  status text not null default 'info',
  message text,
  metadata jsonb not null default '{}',
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists content_engine_activity_logs_created_idx
  on public.content_engine_activity_logs(created_at desc);
create index if not exists content_engine_activity_logs_item_idx
  on public.content_engine_activity_logs(content_item_id, created_at desc);

drop trigger if exists content_channel_approvals_updated_at on public.content_channel_approvals;
create trigger content_channel_approvals_updated_at before update on public.content_channel_approvals
  for each row execute function public.update_updated_at();

alter table public.content_channel_approvals enable row level security;
alter table public.content_engine_activity_logs enable row level security;
drop policy if exists content_channel_approvals_admin_all on public.content_channel_approvals;
create policy content_channel_approvals_admin_all on public.content_channel_approvals
  for all using (public.is_social_studio_admin()) with check (public.is_social_studio_admin());
drop policy if exists content_engine_activity_logs_admin_all on public.content_engine_activity_logs;
create policy content_engine_activity_logs_admin_all on public.content_engine_activity_logs
  for all using (public.is_social_studio_admin()) with check (public.is_social_studio_admin());
grant select, insert, update, delete on public.content_channel_approvals to authenticated, service_role;
grant select, insert, update, delete on public.content_engine_activity_logs to authenticated, service_role;
