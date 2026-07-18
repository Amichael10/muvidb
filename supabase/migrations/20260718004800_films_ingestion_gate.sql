-- =============================================================================
-- INGESTION GATE — stop new clickbait from entering the public catalogue
-- =============================================================================
-- The 3,421 hidden films were a backlog. New clickbait keeps arriving through
-- the YouTube channel syncs (refresh_videos_handler, sync_service,
-- continuous_youtube_sync, ...). Rather than patch every insert site, gate at
-- the DB — one choke point that also covers future sync code.
--
-- Pausing channels was rejected: no channel is pure junk, they mix clickbait
-- re-uploads with real films (see premium-curation-strategy). So we gate per
-- FILM by title, and auto-recover any real film that later proves itself.
-- =============================================================================

-- High-precision narrative-clickbait test (mirrors the batch heuristic's strong
-- phrase list; deliberately omits the looser "long sentence + pronoun" rule so
-- ingestion errs toward keeping films visible).
create or replace function public.is_clickbait_title(t text)
returns boolean
language sql
immutable
as $$
  select coalesce(t, '') ~* '(not knowing|you won''?t believe|will shock|shocked everyone|made everyone cry|real tears|i urge every|urge every woman|leaving everyone in tears|turned out to be a (billionaire|prince|princess|ceo)|for true love|jaw.?dropping|see what happened next|changed (his|her) life forever|fell in love with (a|the|d) (poor|humble|maid|garbage|local)|kicked out to suffer|poor (village|orphan|helpless)|billionaire (lady|ceo|daughter)|in disguise|mocked (and|&) (rejected|humiliated))';
$$;

-- BEFORE INSERT: quarantine clickbait-titled new films (is_published = false).
-- A cleaned film (original_title already set) has been through the pipeline and
-- is exempt.
create or replace function public.films_quarantine_clickbait()
returns trigger
language plpgsql
as $$
begin
  if new.original_title is null and public.is_clickbait_title(new.title) then
    new.is_published := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_films_quarantine_clickbait on public.films;
create trigger trg_films_quarantine_clickbait
  before insert on public.films
  for each row
  execute function public.films_quarantine_clickbait();

-- AUTO-REPUBLISH: a quarantined clickbait film that organically crosses 100
-- views is proven real engagement — surface it. Fires only on the upward
-- crossing, so it won't fight an admin who deliberately hides a popular film.
create or replace function public.films_autopublish_on_engagement()
returns trigger
language plpgsql
as $$
begin
  if new.is_published = false
     and coalesce(old.view_count, 0) < 100
     and coalesce(new.view_count, 0) >= 100
     and public.is_clickbait_title(new.title) then
    new.is_published := true;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_films_autopublish on public.films;
create trigger trg_films_autopublish
  before update of view_count on public.films
  for each row
  execute function public.films_autopublish_on_engagement();
