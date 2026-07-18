-- =============================================================================
-- MULTI-LANGUAGE support — films.languages (text[])
-- =============================================================================
-- A film can be English, Yoruba, another African language, or several at once.
-- The legacy `language` field is a single mixed-format string; `languages` is
-- the clean array. Backfilled from `language` by scratch/backfill_languages;
-- the frontend falls back to parsing `language` when the array isn't set, so
-- nothing breaks before the backfill runs. `language` stays as the primary for
-- the existing Browse filter.
-- =============================================================================

alter table public.films
  add column if not exists languages text[];

-- GIN index so "films that include Yoruba" (languages @> '{Yoruba}') is fast.
create index if not exists idx_films_languages on public.films using gin (languages);

comment on column public.films.languages is
  'Array of display-name languages (English, Yoruba, Hausa, ...). Supports films with multiple languages. Legacy single `language` kept as primary.';
