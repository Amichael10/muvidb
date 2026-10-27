import { describe, expect, it } from 'vitest';
import { isFilmEligibleForIntent, filmCandidateScore } from './candidate_strategy.js';

describe('recency protection: strict 1 to 7 days policy', () => {
  const october2026 = new Date('2026-10-27T12:00:00.000Z');

  it('rejects a movie from July 22, 2026 from catalogue intent', () => {
    const busyBody = {
      id: 'busy-body',
      title: 'Busy Body',
      release_date: '2026-07-22',
      year: 2026,
      release_type: 'youtube',
      poster_url: 'https://example.com/poster.jpg',
      updated_at: '2026-10-27T04:12:00.000Z',
    };
    expect(isFilmEligibleForIntent(busyBody, 'catalogue', october2026)).toBe(false);
  });

  it('rejects a movie older than 7 days (e.g. 12 days ago)', () => {
    const twelveDaysOld = {
      id: 'twelve-days-old',
      title: 'Older Release',
      release_date: '2026-10-15',
      year: 2026,
      release_type: 'youtube',
      poster_url: 'https://example.com/poster.jpg',
    };
    expect(isFilmEligibleForIntent(twelveDaysOld, 'catalogue', october2026)).toBe(false);
    expect(isFilmEligibleForIntent(twelveDaysOld, 'streaming', october2026)).toBe(false);
  });

  it('accepts a fresh movie released within 1 to 7 days', () => {
    const freshMovie = {
      id: 'fresh-movie',
      title: 'Fresh Release',
      release_date: '2026-10-24', // 3 days ago
      year: 2026,
      release_type: 'youtube',
      poster_url: 'https://example.com/poster.jpg',
    };
    expect(isFilmEligibleForIntent(freshMovie, 'catalogue', october2026)).toBe(true);
    expect(isFilmEligibleForIntent(freshMovie, 'streaming', october2026)).toBe(true);
  });

  it('scores freshness using release date, not updated_at', () => {
    const oldMovieUpdatedToday = {
      id: 'old-touched',
      release_date: '2026-07-22',
      updated_at: '2026-10-27T10:00:00.000Z',
      poster_url: 'poster.jpg',
    };
    const newMovieUpdatedLastWeek = {
      id: 'new-untouched',
      release_date: '2026-10-25',
      updated_at: '2026-10-20T10:00:00.000Z',
      poster_url: 'poster.jpg',
    };

    const oldScore = filmCandidateScore(oldMovieUpdatedToday, 'catalogue', october2026);
    const newScore = filmCandidateScore(newMovieUpdatedLastWeek, 'catalogue', october2026);

    expect(newScore).toBeGreaterThan(oldScore);
  });
});
