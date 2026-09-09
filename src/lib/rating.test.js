import { describe, expect, it } from 'vitest';
import {
  pctLiked,
  score10FromLikedPercent,
  formatRatingVotes,
  computeFilmRating,
} from './rating';

describe('rating utilities', () => {
  describe('pctLiked', () => {
    it('maps 0-10 scores onto the calibrated logistic curve', () => {
      expect(pctLiked(4.2)).toBe(50);
      expect(pctLiked(5.0)).toBe(61);
      expect(pctLiked(8.0)).toBeGreaterThan(85);
      expect(pctLiked(2.0)).toBeLessThan(30);
    });

    it('stays within [5, 97]', () => {
      expect(pctLiked(0)).toBe(9);
      expect(pctLiked(10)).toBe(96);
    });
  });

  describe('score10FromLikedPercent', () => {
    it('inverts the logistic curve back to 0-10 score', () => {
      const score = score10FromLikedPercent(50);
      expect(score).toBeCloseTo(4.2, 1);
      const score60 = score10FromLikedPercent(60);
      expect(score60).toBeCloseTo(4.9, 1);
    });

    it('handles high and low percent bounds', () => {
      expect(score10FromLikedPercent(95)).toBeGreaterThan(8.5);
      expect(score10FromLikedPercent(10)).toBeLessThan(2.0);
    });
  });

  describe('formatRatingVotes', () => {
    it('formats numbers with K and M suffixes', () => {
      expect(formatRatingVotes(500)).toBe('500');
      expect(formatRatingVotes(1500)).toBe('1.5K');
      expect(formatRatingVotes(2400000)).toBe('2.4M');
    });

    it('returns null for empty or zero votes', () => {
      expect(formatRatingVotes(0)).toBeNull();
      expect(formatRatingVotes(null)).toBeNull();
    });
  });

  describe('computeFilmRating', () => {
    it('computes composite score from critics and IMDb', () => {
      const result = computeFilmRating({
        film: { imdb_rating: 8.0, imdb_vote_count: 500, liked_percent: 75 },
        criticReviews: [{ rating: 9.0 }, { rating: 8.0 }],
        userLikes: 20,
        userDislikes: 2,
      });

      expect(result.criticScore).toBe(8.5);
      expect(result.criticReviewsCount).toBe(2);
      expect(result.starRating).toBe(8.2); // (0.4 * 8.5) + (0.6 * 8.0) = 3.4 + 4.8 = 8.2
      expect(result.likedPercent).toBe(75);
    });

    it('handles audience-only films', () => {
      const result = computeFilmRating({
        film: { imdb_rating: 7.4, imdb_vote_count: 150 },
      });

      expect(result.starRating).toBe(7.4);
      expect(result.criticScore).toBeNull();
    });
  });
});
