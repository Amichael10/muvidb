-- Provenance for credit rows.
--
-- Credits now arrive from several places — Tesseract OCR of credit rolls,
-- Gemini extraction, TMDB, and the NFVCB approved-movies register — with very
-- different reliability. Without a source column there is no way to tell an
-- officially-published director credit from one guessed off a YouTube title,
-- and no way to re-sync or purge one adapter's output.
--
-- The adapter conventions require every inserted row to carry a source unique
-- to its adapter; credits was the one table that could not.

alter table public.credits
  add column if not exists source text;

-- Only rows that declare a source are queried this way, and they are the
-- minority, so the index stays partial.
create index if not exists credits_source_idx
  on public.credits (source)
  where source is not null;

comment on column public.credits.source is
  'Adapter that produced this credit, e.g. nfvcb_approved_movies. NULL means manual or pre-provenance.';
