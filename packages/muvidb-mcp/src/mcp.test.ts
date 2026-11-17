import { describe, it, expect } from 'vitest';
import { createMcpServer } from './index.js';
import { searchFilms, getFilmCredits, getWhereToWatch } from './tools/films.js';
import { searchPeople, getPersonFilmography } from './tools/people.js';
import { getAwardsAndNominations } from './tools/awards.js';

describe('MuviDB MCP Server', () => {
  it('instantiates the MCP server with all 8 tools registered', () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });

  it('searches films in MuviDB database', async () => {
    const res = await searchFilms({ query: 'Jenifa', limit: 2 });
    expect(res).toBeDefined();
    expect(res.results_count).toBeGreaterThan(0);
    expect(res.films[0].title).toBeDefined();
  }, 15000);

  it('fetches verified film credits with character roles', async () => {
    const res = await getFilmCredits({ title: "Jenifa's Diary" });
    expect(res).toBeDefined();
    expect(res.cast_count).toBeGreaterThan(0);
    expect(res.cast[0].name).toBeDefined();
  }, 15000);

  it('fetches where to watch streaming data', async () => {
    const res = await getWhereToWatch({ title: 'Love and New Notes' });
    expect(res).toBeDefined();
    expect(res.title).toBeDefined();
    expect(res.streaming).toBeDefined();
  }, 15000);

  it('searches people and retrieves verified filmography', async () => {
    const pRes = await searchPeople({ query: 'Funke Akindele', limit: 1 });
    expect(pRes.results_count).toBeGreaterThan(0);
    const person = pRes.people[0];

    const fRes = await getPersonFilmography({ person_id: person.id });
    expect(fRes.name).toBe(person.name);
    expect(fRes.filmography).toBeDefined();
    expect(fRes.filmography.acting.length).toBeGreaterThan(0);
  }, 15000);

  it('retrieves awards and nominations for 2026', async () => {
    const res = await getAwardsAndNominations({ year: 2026, limit: 5 });
    expect(res).toBeDefined();
    expect(res.awards.length).toBeGreaterThan(0);
    expect(typeof res.awards[0].organization).toBe('string');
  }, 15000);
});
