import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('./lib/db', () => ({ supabase: { from } }));
vi.mock('dotenv', () => ({ default: { config: vi.fn() } }));

import { syncFilmAndEnsemble } from './master_filmography_sync';

describe('master sync origin gate', () => {
  beforeEach(() => {
    from.mockReset();
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'existing-film', imdb_id: 'tt4034410', genres: [] },
      }),
    };
    from.mockReturnValue(query);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['missing origin fields', {}],
    ['Young Hollywood with empty country arrays', {
      origin_country: [], production_countries: [], original_language: 'en',
    }],
    ['US production', {
      origin_country: ['US'], production_countries: [{ iso_3166_1: 'US' }], original_language: 'en',
    }],
    ['US production filmed in South Africa', {
      origin_country: ['US'], production_countries: [{ iso_3166_1: 'ZA' }], original_language: 'en',
    }],
    ['non-African country outside the major-studio list', {
      origin_country: ['UY'], production_countries: [], original_language: 'es',
    }],
  ])('rejects %s before even looking up an existing row', async (_, details) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => details }));
    expect(await syncFilmAndEnsemble({ id: 42638, name: 'Young Hollywood', media_type: 'tv' }, new Map()))
      .toEqual({ filmId: '', wasCreated: false, ensembleAdded: 0 });
    expect(from).not.toHaveBeenCalled();
  });

  it.each([
    { origin_country: ['NG'], production_countries: [], original_language: 'en' },
    { origin_country: ['ZA'], production_countries: [{ iso_3166_1: 'ZA' }], original_language: 'en' },
    { origin_country: [], production_countries: [], original_language: 'yo' },
  ])('still accepts positive African-origin evidence: %j', async details => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => details }));
    expect(await syncFilmAndEnsemble({ id: 123, title: 'African production' }, new Map()))
      .toEqual({ filmId: 'existing-film', wasCreated: false, ensembleAdded: 0 });
    expect(from).toHaveBeenCalledExactlyOnceWith('films');
  });
});
