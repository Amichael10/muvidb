import { describe, expect, it } from 'vitest';
import { canonicalizeReleaseFilms, SPOTLIGHT_SERIES_SLUGS, getWeekKey } from './monthly_planner.js';

describe('canonicalizeReleaseFilms', () => {
  it('keeps one post for duplicate title/date records and prefers the complete record', () => {
    const result = canonicalizeReleaseFilms([
      { id: 'thin', title: 'Five Figurines', release_date: '2026-11-13', poster_url: 'poster' },
      { id: 'complete', title: 'Five Figurines', release_date: '2026-11-13', poster_url: 'poster', backdrop_url: 'backdrop', synopsis: 'Story' },
      { id: 'other', title: 'Another Film', release_date: '2026-11-13', poster_url: 'poster' },
    ]);
    expect(result.map(film => film.id).sort()).toEqual(['complete', 'other']);
  });

  it('guarantees SPOTLIGHT_SERIES_SLUGS definitions and week key consistency', () => {
    expect(SPOTLIGHT_SERIES_SLUGS.has('actor_spotlight')).toBe(true);
    expect(SPOTLIGHT_SERIES_SLUGS.has('you_know_the_face')).toBe(true);
    expect(SPOTLIGHT_SERIES_SLUGS.has('behind_the_camera')).toBe(true);
    expect(SPOTLIGHT_SERIES_SLUGS.has('filmography')).toBe(true);
    expect(SPOTLIGHT_SERIES_SLUGS.has('where_to_watch')).toBe(false);
    expect(SPOTLIGHT_SERIES_SLUGS.has('new_and_upcoming')).toBe(false);

    // Same calendar week (Mon 2026-11-09 to Sun 2026-11-15) returns identical week key
    expect(getWeekKey('2026-11-09')).toBe(getWeekKey('2026-11-15'));
  });
});

