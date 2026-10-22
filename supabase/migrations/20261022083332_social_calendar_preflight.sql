alter table public.social_calendar
  add column if not exists preflight_checked_at timestamptz,
  add column if not exists preflight_status text,
  add column if not exists preflight_json jsonb not null default '{}';

create index if not exists social_calendar_preflight_due_idx
  on public.social_calendar(scheduled_date, scheduled_time)
  where subject_entity_type = 'movie'
    and status not in ('published', 'skipped', 'cancelled');

