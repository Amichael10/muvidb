-- Record what a catalogue row actually is: film, trailer, interview, clip,
-- compilation or unclear.
--
-- The catalogue is harvested from YouTube and collects non-films alongside
-- films. Detection today is a regex over the title, which cannot see duration
-- or channel; 387 rows were removed by hand on 2026-08-01 after it missed them.
--
-- Deliberately separate from `needs_review`, which is already true for 18,048
-- rows because the cinema adapter sets it wholesale — a verdict written there
-- would be invisible.
--
-- These columns only ever RECORD a verdict. Nothing in this migration or the
-- classifier hides or deletes a film; acting on a verdict stays a human step.

alter table public.films
  add column if not exists content_kind text,
  add column if not exists content_kind_confidence numeric(3, 2),
  add column if not exists content_kind_checked_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'films_content_kind_check'
  ) then
    alter table public.films
      add constraint films_content_kind_check
      check (
        content_kind is null
        or content_kind in ('film', 'trailer', 'interview', 'clip', 'compilation', 'unclear')
      );
  end if;
end $$;

-- Supports "what still needs checking" and "show me the flagged non-films"
-- without scanning 38k rows. Partial: checked rows are the minority for now,
-- and rows verdicted `film` are not what anyone queries for.
create index if not exists films_content_kind_pending_idx
  on public.films (content_kind_checked_at)
  where content_kind is null;

create index if not exists films_content_kind_flagged_idx
  on public.films (content_kind, content_kind_confidence)
  where content_kind is not null and content_kind <> 'film';

comment on column public.films.content_kind is
  'AI verdict on what this upload actually is. Advisory only — never auto-applied.';
