import { describe, expect, it } from 'vitest';
import {
  classifyFilmLifecycle,
  getSeriesIntent,
  rankAndDedupeFilms,
} from './candidate_strategy.js';

const now = new Date('2026-08-23T12:00:00.000Z');

describe('editorial candidate strategy', () => {
  it('keeps actor series in the people pool', () => {
    expect(getSeriesIntent('you_know_the_face')).toBe('people');
    expect(getSeriesIntent('actor_spotlight')).toBe('people');
    expect(getSeriesIntent('where_to_watch')).toBe('streaming');
    expect(getSeriesIntent('new_and_upcoming')).toBe('upcoming');
  });

  it('does not trust a stale cinema flag', () => {
    expect(classifyFilmLifecycle({ is_in_cinemas: true, release_date: '2025-01-01' }, now)).toBe('catalogue');
    expect(classifyFilmLifecycle({ is_in_cinemas: true, release_date: '2026-08-01' }, now)).toBe('now_in_cinemas');
  });

  it('separates future releases from currently streaming films', () => {
    expect(classifyFilmLifecycle({ release_date: '2026-10-01', release_type: 'nollistream' }, now)).toBe('upcoming');
    expect(classifyFilmLifecycle({ release_date: '2026-08-01', release_type: 'nollistream' }, now)).toBe('now_streaming');
  });

  it('prioritizes NolliStream, then Docuth, and excludes cinema from now-streaming', () => {
    const films = [
      { id: 'cinema', release_date: '2026-08-01', is_in_cinemas: true, poster_url: 'x', updated_at: '2026-08-23' },
      { id: 'docuth', release_date: '2026-07-01', release_type: 'docuth', poster_url: 'x', updated_at: '2026-08-23' },
      { id: 'nolli', release_date: '2026-06-01', release_type: 'nollistream', poster_url: 'x', updated_at: '2026-08-01' },
      { id: 'netflix', release_date: '2026-08-01', release_type: 'netflix', poster_url: 'x', updated_at: '2026-08-23' },
    ];
    expect(rankAndDedupeFilms(films, 'streaming', 10, now).map(f => f.id)).toEqual(['nolli', 'docuth', 'netflix']);
  });

  it('only selects dated future titles for upcoming posts', () => {
    const films = [
      { id: 'future', release_date: '2026-10-01', poster_url: 'x' },
      { id: 'stale-flag', release_date: '2025-01-01', coming_soon: true, poster_url: 'x' },
      { id: 'streaming', release_date: '2026-08-01', release_type: 'docuth', poster_url: 'x' },
    ];
    expect(rankAndDedupeFilms(films, 'upcoming', 10, now).map(f => f.id)).toEqual(['future']);
  });
});
