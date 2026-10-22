drop index if exists public.social_calendar_planner_key_uidx;

create unique index if not exists social_calendar_planner_key_uidx
  on public.social_calendar(planner_key);
