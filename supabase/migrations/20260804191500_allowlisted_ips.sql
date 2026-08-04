-- IPs that never get scrape alerts and cannot be blocked (home / office).

create table if not exists public.allowlisted_ips (
  ip text primary key,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.allowlisted_ips is 'Trusted IPs skipped by scrape_guard and refuse /block.';

alter table public.allowlisted_ips enable row level security;

revoke all on public.allowlisted_ips from anon, authenticated;
grant all on public.allowlisted_ips to service_role;
