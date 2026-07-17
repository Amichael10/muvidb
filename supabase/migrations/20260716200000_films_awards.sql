-- Film-level awards mirror people.awards jsonb shape, e.g.
-- { "category": "Best Movie", "organization": "AMVCA", "year": 2024,
--   "season": 10, "won": true, "recipients": ["BB Sasore"] }.
alter table public.films
  add column if not exists awards jsonb not null default '[]'::jsonb;
