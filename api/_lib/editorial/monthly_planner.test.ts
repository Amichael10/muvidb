import { describe, expect, it } from 'vitest';
import { canonicalizeReleaseFilms } from './monthly_planner.js';

describe('canonicalizeReleaseFilms', () => {
  it('keeps one post for duplicate title/date records and prefers the complete record', () => {
    const result = canonicalizeReleaseFilms([
      { id: 'thin', title: 'Five Figurines', release_date: '2026-11-13', poster_url: 'poster' },
      { id: 'complete', title: 'Five Figurines', release_date: '2026-11-13', poster_url: 'poster', backdrop_url: 'backdrop', synopsis: 'Story' },
      { id: 'other', title: 'Another Film', release_date: '2026-11-13', poster_url: 'poster' },
    ]);
    expect(result.map(film => film.id).sort()).toEqual(['complete', 'other']);
  });
});

