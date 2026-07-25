-- =============================================================================
-- IMDb rating / vote count → liked_percent (same curve as TMDB)
-- User review text is intentionally NOT imported (IP).
-- =============================================================================

alter table public.films
  add column if not exists imdb_id text,
  add column if not exists imdb_rating numeric,
  add column if not exists imdb_vote_count integer;

create unique index if not exists films_imdb_id_uidx
  on public.films (imdb_id)
  where imdb_id is not null;

-- Shared Bayesian + logistic curve (same as tmdb_liked_pct after recalibrate).
create or replace function public.external_liked_pct(avg numeric, votes integer)
returns smallint
language sql
immutable
as $$
  select greatest(5, least(97,
    round(
      100.0 / (1 + exp(-1.15 * (
        ( (coalesce(votes,0)::numeric * coalesce(avg,0) + 25 * 6.5) / (coalesce(votes,0) + 25) )
        - 7.1
      )))
    )
  ))::smallint;
$$;

-- Keep tmdb_liked_pct as an alias so existing callers stay valid.
create or replace function public.tmdb_liked_pct(avg numeric, votes integer)
returns smallint
language sql
immutable
as $$
  select public.external_liked_pct(avg, votes);
$$;

create or replace function public.films_set_external_liked()
returns trigger
language plpgsql
as $$
begin
  -- Priority: TMDB when present, else IMDb. Comment-mined scores (both null)
  -- are left alone for api/_lib/comment_reviews.ts.
  if new.tmdb_rating is not null and new.tmdb_rating > 0 then
    new.liked_percent := public.external_liked_pct(new.tmdb_rating, new.tmdb_vote_count);
  elsif new.imdb_rating is not null and new.imdb_rating > 0 then
    new.liked_percent := public.external_liked_pct(new.imdb_rating, new.imdb_vote_count);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_films_tmdb_liked on public.films;
drop trigger if exists trg_films_external_liked on public.films;
create trigger trg_films_external_liked
  before insert or update of tmdb_rating, tmdb_vote_count, imdb_rating, imdb_vote_count
  on public.films
  for each row
  execute function public.films_set_external_liked();
