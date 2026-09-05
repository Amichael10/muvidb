import { afterEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: db }));
import { rankPeopleResults, rerankPeopleWithCohere, searchPeopleByName } from './peopleSearch';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('shared people search relevance', () => {
  const exact = { id: 'exact', name: 'Toyin Abraham', popularity_score: 1 };
  const partial = { id: 'partial', name: 'Toyin Adewale', popularity_score: 999999999, _semantic: 1 };

  it('puts the full name ahead of popular partial matches', () => {
    expect(rankPeopleResults('  TOYIN   ABRAHAM ', [partial, exact])[0].id).toBe('exact');
    expect(rankPeopleResults('Abraham Toyin', [partial, exact])[0].id).toBe('exact');
  });

  it('preserves exact alias relevance through global re-ranking', () => {
    const alias = { id: 'alias', name: 'Ibrahim Yekini', aliases: ['Itele'] };
    expect(rankPeopleResults('Itele', [{ ...partial, name: 'Itele Junior' }, alias])[0].id).toBe('alias');
  });

  it('reads the actual Cohere API score and uses it within a relevance tier', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ people: [
      { id: 'b', score: 0.9 }, { id: 'a', score: 0.1 },
    ] }) }));
    const rows = await rerankPeopleWithCohere('Toyin', [
      { id: 'a', name: 'Toyin A', popularity_score: 99999 }, { id: 'b', name: 'Toyin B' },
    ]);
    expect(rows[0]._semantic).toBe(0.9);
    expect(rankPeopleResults('Toyin', rows)[0].id).toBe('b');
  });

  it('keeps lexical results when Cohere is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(rankPeopleResults('Toyin Abraham', await rerankPeopleWithCohere('Toyin Abraham', [partial, exact]))[0].id).toBe('exact');
  });

  it('retrieves the exact person outside the broad candidate limit, without the name RPC', async () => {
    db.rpc.mockResolvedValue({ data: [], error: { message: 'Could not find the function' } });
    db.from.mockImplementation(table => {
      let rows = table === 'people' ? [partial] : [];
      const builder = {
        select: () => builder,
        eq: () => { rows = []; return builder; },
        ilike: (field, value) => { rows = table === 'people' && value === 'Toyin Abraham' ? [{ ...exact, bio: 'Full profile' }] : []; return builder; },
        or: () => builder,
        limit: () => builder,
        in: () => { rows = [{ ...exact, bio: 'Full profile' }, partial]; return builder; },
        then: resolve => Promise.resolve({ data: rows, error: null }).then(resolve),
      };
      return builder;
    });
    const rows = await searchPeopleByName('Toyin Abraham', { limit: 8, select: '*', useCohere: false });
    expect(rows[0].id).toBe('exact');
    expect(rows[0].bio).toBe('Full profile');
  });
});
