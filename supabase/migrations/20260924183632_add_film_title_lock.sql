-- Preserve titles that an administrator has deliberately edited.
alter table public.films
  add column if not exists title_locked boolean not null default false;

comment on column public.films.title_locked is
  'True when an administrator has edited the catalogue title; automated sync and cleanup jobs must preserve it.';
