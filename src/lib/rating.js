/**
 * Client-side rating utilities for MuviDB.
 *
 * Implements the shared curve and multi-source composite rating calculation
 * for frontend components (FilmCard, FilmDetail, WatchOptions, etc.).
 */

export function pctLiked(score10) {
  if (score10 == null || isNaN(score10)) return null;
  const x = Math.max(0, Math.min(10, Number(score10)));
  const p = 100 / (1 + Math.exp(-1.15 * (x - 7.1)));
  return Math.round(Math.max(5, Math.min(97, p)));
}

export function score10FromLikedPercent(likedPct) {
  if (likedPct == null || isNaN(likedPct)) return null;
  const p = Math.max(5.1, Math.min(96.9, Number(likedPct)));
  const x = 7.1 - (1 / 1.15) * Math.log((100 - p) / p);
  return Math.round(Math.max(1.0, Math.min(9.7, x)) * 10) / 10;
}

export function formatRatingVotes(count) {
  if (!count || count <= 0) return null;
  const n = Number(count);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/**
 * Calculates a composite film rating from all available signals:
 * - Verified critic reviews (critic_reviews)
 * - IMDb / TMDB / YouTube audience score
 * - On-platform likes / reactions
 */
export function computeFilmRating(params = {}) {
  const { film, criticReviews = [], userLikes = 0, userDislikes = 0 } = params;
  if (!film) {
    return {
      starRating: null,
      likedPercent: null,
      criticScore: null,
      criticReviewsCount: 0,
      totalVotesCount: 0,
    };
  }

  // 1. Critic Score
  const validCriticRatings = (criticReviews || [])
    .map((r) => (r.rating != null && r.rating !== '' ? Number(r.rating) : null))
    .filter((n) => n !== null && !isNaN(n) && n > 0 && n <= 10);

  const criticReviewsCount = validCriticRatings.length;
  const criticScore =
    criticReviewsCount > 0
      ? Math.round(
          (validCriticRatings.reduce((a, b) => a + b, 0) / criticReviewsCount) * 10
        ) / 10
      : null;

  // 2. Base External Score (0-10)
  let baseScore10 = null;
  let totalVotes = 0;

  if (film.imdb_rating != null && Number(film.imdb_rating) > 0) {
    baseScore10 = Number(film.imdb_rating);
    totalVotes += film.imdb_vote_count || 120;
  } else if (film.tmdb_rating != null && Number(film.tmdb_rating) > 0) {
    baseScore10 = Number(film.tmdb_rating);
    totalVotes += film.tmdb_vote_count || 60;
  } else if (film.audience_rating != null && Number(film.audience_rating) > 0) {
    baseScore10 = Number(film.audience_rating);
    totalVotes += film.audience_rating_count || 25;
  } else if (film.liked_percent != null && Number(film.liked_percent) > 0) {
    baseScore10 = score10FromLikedPercent(Number(film.liked_percent));
  }

  // YouTube Stats adjustment
  if (film.youtube_stats) {
    const stats = Array.isArray(film.youtube_stats) ? film.youtube_stats[0] : film.youtube_stats;
    const views = stats?.view_count || 0;
    const likes = stats?.like_count || 0;
    if (views >= 1000 && likes > 0) {
      const likeRatio = likes / views;
      totalVotes += Math.min(500, Math.round(views / 1000));
      if (baseScore10 == null) {
        baseScore10 = Math.min(8.8, Math.max(5.5, 6.0 + likeRatio * 50));
      }
    }
  }

  // 3. User Reactions
  const reactionsTotal = Number(userLikes || 0) + Number(userDislikes || 0);
  totalVotes += reactionsTotal;

  // 4. Blend Star Rating (0-10)
  let starRating = null;
  if (criticScore != null && baseScore10 != null) {
    // 40% Critics, 60% Audience/External
    starRating = Math.round((0.4 * criticScore + 0.6 * baseScore10) * 10) / 10;
  } else if (criticScore != null) {
    starRating = criticScore;
  } else if (baseScore10 != null) {
    starRating = Math.round(baseScore10 * 10) / 10;
  }

  // 5. Liked Percent (0-100)
  let likedPercent = film.liked_percent != null ? Number(film.liked_percent) : null;
  if (likedPercent == null && starRating != null) {
    likedPercent = pctLiked(starRating);
  }

  return {
    starRating,
    likedPercent,
    criticScore,
    criticReviewsCount,
    totalVotesCount: totalVotes,
  };
}
