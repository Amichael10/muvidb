-- =============================================================================
-- RECALIBRATE the liked_percent curve (steeper, less generous)
-- =============================================================================
-- The first curve still read too high (fan comments skew positive). Steepen and
-- shift right: logistic k=1.15, midpoint 7.1, floor 5. A genuinely acclaimed,
-- well-voted film still reaches the 80s; an ordinary upload lands 40s-50s.
-- Must stay in lockstep with pctLiked() in api/_lib/rating.ts.
-- =============================================================================

create or replace function public.tmdb_liked_pct(avg numeric, votes integer)
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
