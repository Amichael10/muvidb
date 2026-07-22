-- Track aggressive SEO/page crawls and Telegram alert cooldowns.
-- Used by api/_lib/scrape_guard.ts (people/films SSR hits via api/seo.ts).

create table if not exists public.scrape_ip_buckets (
  ip text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  sample_paths text[] not null default '{}'::text[],
  user_agent text,
  updated_at timestamptz not null default now(),
  primary key (ip, window_start)
);

create index if not exists scrape_ip_buckets_window_idx
  on public.scrape_ip_buckets (window_start desc);

create table if not exists public.scrape_alert_log (
  ip text primary key,
  last_alert_at timestamptz not null default now(),
  last_hits integer,
  last_message text
);

alter table public.scrape_ip_buckets enable row level security;
alter table public.scrape_alert_log enable row level security;

-- Service role only (API uses service key). No public policies.
revoke all on public.scrape_ip_buckets from anon, authenticated;
revoke all on public.scrape_alert_log from anon, authenticated;
grant all on public.scrape_ip_buckets to service_role;
grant all on public.scrape_alert_log to service_role;
