-- App-level IP blocklist for Telegram ops (/block /unblock).
-- Enforced in api/ssr.ts + api/data.ts via service role.

create table if not exists public.blocked_ips (
  ip text primary key,
  reason text,
  blocked_by text not null default 'telegram',
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists blocked_ips_expires_idx
  on public.blocked_ips (expires_at)
  where expires_at is not null;

comment on table public.blocked_ips is 'IPs refused by SSR/API. Managed via Telegram ops bot.';

alter table public.blocked_ips enable row level security;

revoke all on public.blocked_ips from anon, authenticated;
grant all on public.blocked_ips to service_role;
