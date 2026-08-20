/**
 * Unified "% liked" rating — the single audience metric shown across the site.
 *
 * Everything funnels through ONE calibrated curve, `pctLiked(score10)`, so a
 * TMDB 0-10 average and our comment-derived score land on the same comparable
 * scale. The curve is a logistic centred at 7.1 with a steep slope — a
 * deliberately demanding calibration so scores read honestly low: fan comments
 * skew positive, so "average" reception should NOT look like acclaim.
 *
 *    5.0 -> 14%   6.0 -> 22%   7.0 -> 47%   7.7 -> 67%   8.5 -> 83%
 *
 * A genuinely acclaimed, well-voted film still reaches the 80s; an ordinary
 * upload lands in the 40s-50s and a weak one drops below 40%. Only real,
 * broad approval earns a high number.
 */

/** Map a 0-10 quality/sentiment score to a 0-100 "% liked". Clamped to
 *  [5, 97] — nothing is universally loved, and a "97%" reads as excellent
 *  without the fake-perfect problem the old 9.8s had. */
export function pctLiked(score10: number): number {
  const x = Math.max(0, Math.min(10, score10));
  const p = 100 / (1 + Math.exp(-1.15 * (x - 7.1)));
  return Math.round(Math.max(5, Math.min(97, p)));
}

/**
 * De-inflated comment score (0-10) before it hits `pctLiked`.
 *
 * Two corrections to the raw mean:
 *  1. Bayesian shrink toward a prior of 6.5 (an average film, NOT 8.0) — a
 *     handful of glowing comments shouldn't read as acclaim.
 *  2. The prior is worth ~10 comments, so real volume moves the score but a
 *     thin sample stays near "unremarkable".
 *
 * The rest of the de-inflation is upstream: we keep critical/commentary
 * comments (not just praise) and score them on a stricter rubric, so the raw
 * mean feeding this is honest in the first place.
 */
export const COMMENT_PRIOR_MEAN = 6.5;
export const COMMENT_PRIOR_WEIGHT = 10;

/**
 * Qualifying opinions required before a film may publish a rating at all.
 *
 * Shrinkage alone can't rescue a 3-comment film: it just parks it near the
 * prior and presents that guess as a measurement. Below this floor we keep the
 * mined reviews but leave liked_percent/audience_rating null, and the film
 * detail page falls back to its "Be the first to rate" state.
 */
export const MIN_RATING_SAMPLE = 8;
export function shrinkCommentScore(weightedMean: number, count: number): number {
  const n = Math.max(0, count);
  return (n * weightedMean + COMMENT_PRIOR_WEIGHT * COMMENT_PRIOR_MEAN) / (n + COMMENT_PRIOR_WEIGHT);
}

/**
 * TMDB "% liked" — the same idea IMDb/TMDB use for their ranked lists.
 *
 * A raw TMDB average is unreliable at low vote counts (one 10/10 vote reads as
 * a perfect film), so we FIRST Bayesian-shrink it toward the global mean by
 * vote count, THEN map through the shared curve. A film with 2 votes at 10.0
 * lands ~68%; a film with hundreds of votes keeps its real average.
 *
 *   WR = (v/(v+m))·avg + (m/(v+m))·C     C = 6.5, m = 25 votes
 *
 * (This mirrors the tmdb_liked_pct() SQL function that the DB trigger uses.)
 */
export const TMDB_PRIOR_MEAN = 6.5;
export const TMDB_MIN_VOTES = 25;
export function tmdbLikedPercent(voteAverage: number, voteCount: number): number {
  const v = Math.max(0, voteCount);
  const wr = (v * voteAverage + TMDB_MIN_VOTES * TMDB_PRIOR_MEAN) / (v + TMDB_MIN_VOTES);
  return pctLiked(wr);
}

/** Same Bayesian + curve as TMDB — IMDb's official aggregate is also 0–10. */
export const imdbLikedPercent = tmdbLikedPercent;

/**
 * Blend site likes/dislikes into a base liked % (TMDB / IMDb / YouTube).
 *
 * Mirrors `reaction_liked_blend()` in
 * supabase/migrations/20260802224000_stricter_reaction_liked_blend.sql —
 * SQL is authoritative for live updates; this helper is for tests/docs.
 *
 * Hard to move on purpose: 120 ghost votes, no-base anchor 40%, and at least
 * 10 reactions before thumbs alone can mint a liked_percent. With a base,
 * one like barely nudges; volume has to earn a climb.
 */
export const REACTION_PRIOR_WEIGHT = 120;
export const REACTION_NO_BASE_ANCHOR = 40;
export const REACTION_MIN_NO_BASE = 10;

export function blendReactionLikedPercent(
  baseLiked: number | null | undefined,
  likes: number,
  dislikes: number,
): number | null {
  const L = Math.max(0, likes | 0);
  const D = Math.max(0, dislikes | 0);
  const n = L + D;
  if (n === 0) {
    return baseLiked == null ? null : Math.round(baseLiked);
  }
  if (baseLiked == null && n < REACTION_MIN_NO_BASE) {
    return null;
  }
  const anchor = baseLiked == null ? REACTION_NO_BASE_ANCHOR : Number(baseLiked);
  const pct =
    ((L + REACTION_PRIOR_WEIGHT * (anchor / 100)) / (n + REACTION_PRIOR_WEIGHT)) * 100;
  return Math.round(Math.max(5, Math.min(97, pct)));
}

/**
 * Approximate 0-10 score from a 0-100 "% liked" value (inverse of `pctLiked`).
 * Clamped to [1.0, 9.7] with 1 decimal place.
 */
export function score10FromLikedPercent(likedPct: number): number {
  const p = Math.max(5.1, Math.min(96.9, likedPct));
  // Invert p = 100 / (1 + exp(-1.15 * (x - 7.1)))
  const x = 7.1 - (1 / 1.15) * Math.log((100 - p) / p);
  return Math.round(Math.max(1.0, Math.min(9.7, x)) * 10) / 10;
}

export type FilmRatingSignals = {
  imdb_rating?: number | null;
  imdb_vote_count?: number | null;
  tmdb_rating?: number | null;
  tmdb_vote_count?: number | null;
  audience_rating?: number | null;
  audience_rating_count?: number | null;
  liked_percent?: number | null;
  streaming_links?: Record<string, any> | null;
  youtube_stats?: {
    view_count?: number;
    like_count?: number;
    comment_count?: number;
  } | null;
};

export type CriticReviewSignal = {
  rating?: number | string | null;
  is_featured?: boolean;
};

export type CompositeRatingResult = {
  starRating: number | null; // 0.0 - 10.0 scale (e.g. 7.8)
  likedPercent: number | null; // 0 - 100% scale (e.g. 84)
  criticScore: number | null; // 0.0 - 10.0 scale for verified critics
  criticReviewsCount: number;
  totalVotesCount: number;
  primarySource: 'imdb' | 'tmdb' | 'critics' | 'youtube' | 'blended' | 'community';
};

/**
 * Compute multi-pillar composite rating combining:
 * 1. Expert Film Critic reviews (critic_reviews)
 * 2. External authority ratings (IMDb, TMDB, Prime Video)
 * 3. YouTube video engagement & mined comment sentiment
 * 4. In-app user reactions (likes/dislikes)
 */
export function computeCompositeRating(params: {
  film?: FilmRatingSignals | null;
  criticReviews?: CriticReviewSignal[] | null;
  userLikes?: number;
  userDislikes?: number;
}): CompositeRatingResult {
  const { film, criticReviews = [], userLikes = 0, userDislikes = 0 } = params;

  // 1. Critic Score
  const validCriticRatings = (criticReviews || [])
    .map((r) => (r.rating != null && r.rating !== '' ? Number(r.rating) : null))
    .filter((n): n is number => n !== null && !isNaN(n) && n > 0 && n <= 10);

  const criticReviewsCount = validCriticRatings.length;
  const criticScore =
    criticReviewsCount > 0
      ? Math.round(
          (validCriticRatings.reduce((a, b) => a + b, 0) / criticReviewsCount) * 10
        ) / 10
      : null;

  // 2. Base External Score (0-10) and Vote Count
  let baseScore10: number | null = null;
  let totalVotes = 0;
  let primarySource: CompositeRatingResult['primarySource'] = 'community';

  if (film?.imdb_rating != null && Number(film.imdb_rating) > 0) {
    baseScore10 = Number(film.imdb_rating);
    totalVotes += film.imdb_vote_count || 100;
    primarySource = 'imdb';
  } else if (film?.tmdb_rating != null && Number(film.tmdb_rating) > 0) {
    baseScore10 = Number(film.tmdb_rating);
    totalVotes += film.tmdb_vote_count || 50;
    primarySource = 'tmdb';
  } else if (film?.audience_rating != null && Number(film.audience_rating) > 0) {
    baseScore10 = Number(film.audience_rating);
    totalVotes += film.audience_rating_count || 20;
    primarySource = 'youtube';
  } else if (film?.liked_percent != null && Number(film.liked_percent) > 0) {
    baseScore10 = score10FromLikedPercent(Number(film.liked_percent));
    primarySource = 'blended';
  }

  // YouTube Stats adjustment (if available)
  if (film?.youtube_stats) {
    const views = film.youtube_stats.view_count || 0;
    const likes = film.youtube_stats.like_count || 0;
    if (views >= 1000 && likes > 0) {
      const likeRatio = likes / views; // e.g. 0.04 = 4% like rate
      totalVotes += Math.min(500, Math.round(views / 1000));
      if (baseScore10 == null) {
        // Approximate 6.0 to 8.8 based on like ratio
        baseScore10 = Math.min(8.8, Math.max(5.5, 6.0 + likeRatio * 50));
        primarySource = 'youtube';
      }
    }
  }

  // 3. User Reactions
  const reactionsTotal = userLikes + userDislikes;
  totalVotes += reactionsTotal;

  // 4. Blend Star Rating (0-10)
  let starRating: number | null = null;
  if (criticScore != null && baseScore10 != null) {
    // 40% Critics, 60% Audience/External
    starRating = Math.round((0.4 * criticScore + 0.6 * baseScore10) * 10) / 10;
    primarySource = 'blended';
  } else if (criticScore != null) {
    starRating = criticScore;
    primarySource = 'critics';
  } else if (baseScore10 != null) {
    starRating = Math.round(baseScore10 * 10) / 10;
  }

  // 5. Liked Percent (0-100)
  let likedPercent = film?.liked_percent ?? null;
  if (likedPercent == null && starRating != null) {
    likedPercent = pctLiked(starRating);
  }
  if (reactionsTotal > 0) {
    likedPercent = blendReactionLikedPercent(likedPercent, userLikes, userDislikes);
  }

  return {
    starRating,
    likedPercent,
    criticScore,
    criticReviewsCount,
    totalVotesCount: totalVotes,
    primarySource,
  };
}
