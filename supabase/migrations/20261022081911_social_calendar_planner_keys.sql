-- Make the rolling social planner safe to run after every content sync.
-- One key represents one intentional calendar slot; different release films
-- retain different keys even when they share a publishing date.

alter table public.social_calendar
  add column if not exists planner_key text;

create unique index if not exists social_calendar_planner_key_uidx
  on public.social_calendar(planner_key)
  where planner_key is not null;

