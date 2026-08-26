import { describe, expect, it } from 'vitest';
import { resolveFilmGenreSelection, visibleFilmGenres } from './filmGenres';

const genres = [
  { id: '8c5383fd-3fec-458c-9ddb-6fbd8485eabc', name: 'Drama' },
  { id: '946ab947-2753-435b-91c0-be7763f293b1', name: 'Thriller' },
  { id: '11111111-1111-4111-8111-111111111111', name: 'Suspense' },
  { id: '22222222-2222-4222-8222-222222222222', name: 'Experimental' },
];

describe('film genre selection', () => {
  it('converts legacy names and UUIDs to unique canonical IDs', () => {
    expect(resolveFilmGenreSelection(['Drama', '946ab947-2753-435b-91c0-be7763f293b1', 'drama'], genres)).toEqual({
      ids: ['8c5383fd-3fec-458c-9ddb-6fbd8485eabc', '946ab947-2753-435b-91c0-be7763f293b1'],
      names: ['Drama', 'Thriller'],
      unresolved: [],
    });
  });

  it('does not pass unknown names into UUID relationship columns', () => {
    expect(resolveFilmGenreSelection(['Drama', 'Not A Genre'], genres)).toMatchObject({
      ids: ['8c5383fd-3fec-458c-9ddb-6fbd8485eabc'],
      unresolved: ['Not A Genre'],
    });
  });

  it('keeps core and selected extra genres visible while collapsed', () => {
    expect(visibleFilmGenres(genres, ['22222222-2222-4222-8222-222222222222'], false).map((genre) => genre.name))
      .toEqual(['Drama', 'Thriller', 'Suspense', 'Experimental']);
  });
});
