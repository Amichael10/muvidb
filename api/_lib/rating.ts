/**
 * Unified "% liked" rating — the single audience metric shown across the site.
 *
 * Everything funnels through ONE calibrated curve, `pctLiked(score10)`, so a
 * TMDB 0-10 average and our comment-derived score land on the same comparable
 * scale. The curve is a logistic centred at 5.5 (a genuinely mixed film) with a
 * gentle slope, tuned against how IMDb/TMDB averages relate to Rotten Tomatoes
 * audience percentages:
 *
 *    5.0 -> 39%   6.0 -> 61%   7.0 -> 79%   7.7 -> 88%   8.5 -> 94%
 *
 * So a classic that reads 7.7 on IMDb shows ~88% here — and an ordinary upload
 * has to genuinely earn its score to beat it, instead of coasting on fan hype.
 */

/** Map a 0-10 quality/sentiment score to a 0-100 "% liked". Clamped to
 *  [10, 97] — nothing is universally loved or universally hated, and a "97%"
 *  reads as excellent without the fake-perfect problem the old 9.8s had. */
export function pctLiked(score10: number): number {
  const x = Math.max(0, Math.min(10, score10));
  const p = 100 / (1 + Math.exp(-0.9 * (x - 5.5)));
  return Math.round(Math.max(10, Math.min(97, p)));
}

/**
 * De-inflated comment score (0-10) before it hits `pctLiked`.
 *
 * Two corrections to the raw likes-weighted mean:
 *  1. Bayesian shrink toward a prior of 6.5 (an average film, NOT 8.0) — a
 *     handful of glowing comments shouldn't read as acclaim.
 *  2. The prior is worth only ~6 comments now (was 10) so real volume moves the
 *     score, but low-sample films still sit near "decent", not "amazing".
 *
 * The rest of the de-inflation is upstream: we keep critical/commentary
 * comments (not just praise) and score them on a stricter rubric, so the raw
 * mean feeding this is honest in the first place.
 */
export const COMMENT_PRIOR_MEAN = 6.5;
export const COMMENT_PRIOR_WEIGHT = 6;
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
 * lands ~76%; a film with hundreds of votes keeps its real average.
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
