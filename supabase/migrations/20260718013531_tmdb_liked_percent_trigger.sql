-- =============================================================================
-- TMDB -> liked_percent, maintained by trigger (Bayesian, vote-count aware)
-- =============================================================================
-- A raw TMDB average lies at low vote counts (one 10/10 vote = "perfect film").
-- tmdb_rating is written from ~8 different sync sites; rather than patch each,
-- a trigger keeps liked_percent correct for TMDB films: shrink the average
-- toward the global mean by vote count, then map through the shared curve.
-- Comment-only films (tmdb_rating null) are untouched — their liked_percent is
-- set by api/_lib/comment_reviews.ts. Mirrors api/_lib/rating.ts.
-- =============================================================================

alter table public.films
  add column if not exists tmdb_vote_count integer;

-- WR = (v/(v+m))*avg + (m/(v+m))*C, then logistic to 0-100, clamped [10,97].
-- C = 6.5, m = 25 votes (gentle — this catalogue's films have modest vote counts).
create or replace function public.tmdb_liked_pct(avg numeric, votes integer)
returns smallint
language sql
immutable
as $$
  select greatest(10, least(97,
    round(
      100.0 / (1 + exp(-0.9 * (
        ( (coalesce(votes,0)::numeric * coalesce(avg,0) + 25 * 6.5) / (coalesce(votes,0) + 25) )
        - 5.5
      )))
    )
  ))::smallint;
$$;

create or replace function public.films_set_tmdb_liked()
returns trigger
language plpgsql
as $$
begin
  -- Only drive liked_percent from TMDB when there's a TMDB rating; leave
  -- comment-derived scores (tmdb_rating null) to the mining pipeline.
  if new.tmdb_rating is not null and new.tmdb_rating > 0 then
    new.liked_percent := public.tmdb_liked_pct(new.tmdb_rating, new.tmdb_vote_count);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_films_tmdb_liked on public.films;
create trigger trg_films_tmdb_liked
  before insert or update of tmdb_rating, tmdb_vote_count on public.films
  for each row
  execute function public.films_set_tmdb_liked();
