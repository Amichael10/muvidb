-- Awards / recognitions for a person. jsonb array so each entry can carry
-- structured detail later, e.g. { "title": "...", "year": 2024,
-- "category": "Best Actor", "organization": "AMVCA", "won": true }.
-- Defaults to an empty array; the person details page shows a "coming soon"
-- state until entries are added.
alter table public.people
  add column if not exists awards jsonb not null default '[]'::jsonb;
