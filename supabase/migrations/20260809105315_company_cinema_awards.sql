-- Awards / recognitions for companies and cinemas. Mirrors people.awards and
-- films.awards so the public Awards page can represent industry honours across
-- the full cinema value chain.
alter table public.companies
  add column if not exists awards jsonb not null default '[]'::jsonb;

alter table public.cinemas
  add column if not exists awards jsonb not null default '[]'::jsonb;
