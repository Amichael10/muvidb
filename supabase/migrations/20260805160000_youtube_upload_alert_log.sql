-- Track Telegram alerts for new YouTube uploads (ops monitoring).
create table if not exists public.youtube_upload_alert_log (
  channel_id uuid not null references public.channels(id) on delete cascade,
  video_id text not null,
  notified_at timestamptz not null default now(),
  title text,
  primary key (channel_id, video_id)
);

create index if not exists idx_youtube_upload_alert_log_notified
  on public.youtube_upload_alert_log (notified_at desc);

alter table public.youtube_upload_alert_log enable row level security;

-- Service role only (same posture as scrape_alert_log).
revoke all on public.youtube_upload_alert_log from anon, authenticated;
