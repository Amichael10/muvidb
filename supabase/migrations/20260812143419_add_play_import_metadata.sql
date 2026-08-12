alter table public.plays
  add column if not exists performance_time text,
  add column if not exists source_url text;

comment on column public.plays.performance_time is 'Human-readable performance time captured from theatre listings, for example 6:00 PM.';
comment on column public.plays.source_url is 'Original source URL for the play listing, such as an Instagram post or theatre page.';
