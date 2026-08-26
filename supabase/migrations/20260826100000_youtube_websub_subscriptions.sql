-- Near-real-time YouTube upload notifications via WebSub (PubSubHubbub).
-- One row per monitored MuviDB channel stores the subscription lease and the
-- first-run baseline that prevents existing uploads from being announced.
create table if not exists public.youtube_websub_subscriptions (
  channel_id uuid primary key references public.channels(id) on delete cascade,
  youtube_channel_id text not null,
  topic_url text not null,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'failed', 'unsubscribed')),
  baseline_at timestamptz not null default now(),
  lease_expires_at timestamptz,
  last_verified_at timestamptz,
  last_subscribe_attempt_at timestamptz,
  last_event_at timestamptz,
  last_reconciled_at timestamptz,
  last_video_id text,
  last_video_published_at timestamptz,
  failure_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_youtube_websub_external_channel
  on public.youtube_websub_subscriptions (youtube_channel_id);

create index if not exists idx_youtube_websub_lease
  on public.youtube_websub_subscriptions (status, lease_expires_at);

alter table public.youtube_websub_subscriptions enable row level security;
revoke all on public.youtube_websub_subscriptions from anon, authenticated;
grant all on public.youtube_websub_subscriptions to service_role;

-- Reserve an alert row before Telegram is called so a duplicate WebSub event
-- and a simultaneous reconciliation run cannot both send the same alert.
alter table public.youtube_upload_alert_log
  add column if not exists status text not null default 'notified'
    check (status in ('processing', 'notified', 'failed')),
  add column if not exists source text not null default 'legacy',
  add column if not exists last_error text;

