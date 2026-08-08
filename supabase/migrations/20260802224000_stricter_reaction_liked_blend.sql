-- =============================================================================
-- Stricter reaction → liked_percent dampening
--
-- Early thumbs must not mint a ~50%+ score. Harder prior, lower no-base anchor,
-- and a minimum reaction count before reactions alone can set liked_percent.
-- Lockstep with blendReactionLikedPercent() in api/_lib/rating.ts.
-- =============================================================================

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
  prior integer := 120;
  min_no_base integer := 10;
  anchor numeric;
begin
  if n = 0 then
    return base_liked;
  end if;

  -- No external/YouTube base: need real volume before a % appears at all.
  if base_liked is null and n < min_no_base then
    return null;
  end if;

  -- Unproven films anchor low (40%), not at a flattering mid-score.
  anchor := coalesce(base_liked, 40)::numeric;
  return greatest(5, least(97,
    round((v_likes + prior * anchor / 100.0) / (n + prior) * 100.0)
  ))::smallint;
end;
$$;
