-- =============================================================================
-- Blend user likes/dislikes into films.liked_percent (Bayesian dampened)
--
-- Thumbs must not waste, but early votes must not shoot scores into the 80s.
-- Prior: 40 ghost votes anchored at the external/YouTube base (or 55% if none).
-- Must stay in lockstep with blendReactionLikedPercent() in api/_lib/rating.ts.
-- =============================================================================

-- Logistic only (score already shrunk) — mirrors pctLiked() in rating.ts.
create or replace function public.score10_liked_pct(score numeric)
returns smallint
language sql
immutable
as $$
  select case
    when score is null then null
    else greatest(5, least(97,
      round(100.0 / (1 + exp(-1.15 * (score::numeric - 7.1))))
    ))::smallint
  end;
$$;

-- Base liked % before user reactions: TMDB → IMDb → YouTube audience_rating.
create or replace function public.film_base_liked_percent(
  p_tmdb_rating numeric,
  p_tmdb_vote_count integer,
  p_imdb_rating numeric,
  p_imdb_vote_count integer,
  p_audience_rating numeric
)
returns smallint
language sql
immutable
as $$
  select case
    when p_tmdb_rating is not null and p_tmdb_rating > 0 then
      public.external_liked_pct(p_tmdb_rating, p_tmdb_vote_count)
    when p_imdb_rating is not null and p_imdb_rating > 0 then
      public.external_liked_pct(p_imdb_rating, p_imdb_vote_count)
    when p_audience_rating is not null and p_audience_rating > 0 then
      public.score10_liked_pct(p_audience_rating)
    else null
  end;
$$;

-- Blend reaction counts into a base liked %. n=0 → return base (may be null).
create or replace function public.reaction_liked_blend(
  base_liked smallint,
  likes integer,
  dislikes integer
)
returns smallint
language plpgsql
immutable
as $$
declare
  v_likes integer := greatest(0, coalesce(likes, 0));
  v_dislikes integer := greatest(0, coalesce(dislikes, 0));
  n integer := v_likes + v_dislikes;
  prior integer := 40;
  anchor numeric;
begin
  if n = 0 then
    return base_liked;
  end if;

  anchor := coalesce(base_liked, 55)::numeric;
  return greatest(5, least(97,
    round((v_likes + prior * anchor / 100.0) / (n + prior) * 100.0)
  ))::smallint;
end;
$$;

-- Recompute and persist liked_percent for one film (security definer: updates films).
create or replace function public.recompute_film_liked_percent(p_film_id uuid)
returns smallint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tmdb_rating numeric;
  v_tmdb_vote_count integer;
  v_imdb_rating numeric;
  v_imdb_vote_count integer;
  v_audience_rating numeric;
  v_likes integer := 0;
  v_dislikes integer := 0;
  v_base smallint;
  v_liked smallint;
begin
  select
    tmdb_rating, tmdb_vote_count, imdb_rating, imdb_vote_count, audience_rating
  into
    v_tmdb_rating, v_tmdb_vote_count, v_imdb_rating, v_imdb_vote_count, v_audience_rating
  from public.films
  where id = p_film_id;

  if not found then
    return null;
  end if;

  select
    count(*) filter (where reaction_type = 'like'),
    count(*) filter (where reaction_type = 'dislike')
  into v_likes, v_dislikes
  from public.film_reactions
  where film_id = p_film_id;

  v_base := public.film_base_liked_percent(
    v_tmdb_rating, v_tmdb_vote_count,
    v_imdb_rating, v_imdb_vote_count,
    v_audience_rating
  );
  v_liked := public.reaction_liked_blend(v_base, v_likes, v_dislikes);

  update public.films
  set liked_percent = v_liked
  where id = p_film_id;

  return v_liked;
end;
$$;

revoke execute on function public.recompute_film_liked_percent(uuid) from public, anon, authenticated;
grant execute on function public.recompute_film_liked_percent(uuid) to service_role;

-- After any reaction write, refresh the film's displayed liked %.
create or replace function public.trg_film_reactions_recompute_liked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_film_liked_percent(old.film_id);
    return old;
  end if;

  perform public.recompute_film_liked_percent(new.film_id);
  if tg_op = 'UPDATE' and old.film_id is distinct from new.film_id then
    perform public.recompute_film_liked_percent(old.film_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_film_reactions_recompute_liked on public.film_reactions;
create trigger trg_film_reactions_recompute_liked
  after insert or update or delete on public.film_reactions
  for each row
  execute function public.trg_film_reactions_recompute_liked();

-- TMDB/IMDb path: compute base, then blend current reaction counts.
create or replace function public.films_set_external_liked()
returns trigger
language plpgsql
as $$
declare
  v_base smallint;
  v_likes integer := 0;
  v_dislikes integer := 0;
begin
  if new.tmdb_rating is not null and new.tmdb_rating > 0 then
    v_base := public.external_liked_pct(new.tmdb_rating, new.tmdb_vote_count);
  elsif new.imdb_rating is not null and new.imdb_rating > 0 then
    v_base := public.external_liked_pct(new.imdb_rating, new.imdb_vote_count);
  else
    -- Comment-mined / reaction-only scores are owned by recompute_film_liked_percent.
    return new;
  end if;

  if new.id is not null then
    select
      count(*) filter (where reaction_type = 'like'),
      count(*) filter (where reaction_type = 'dislike')
    into v_likes, v_dislikes
    from public.film_reactions
    where film_id = new.id;
  end if;

  new.liked_percent := public.reaction_liked_blend(v_base, v_likes, v_dislikes);
  return new;
end;
$$;
