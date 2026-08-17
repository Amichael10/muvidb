import { describe, expect, it } from 'vitest';
import { buildCareerPassportModel, careerPassportFilename, careerPassportShareText, getCareerPassportId } from './careerPassport';

const person = { id: 'abc-123', slug: 'ada-example', name: 'Ada Example', nationality: 'Nigerian', known_for_department: 'Actor', claimed_by: 'user-1' };
const credits = [
  { role: 'actor', film_id: '1', films: { id: '1', title: 'First Film', year: 2025, release_type: 'cinema' } },
  { role: 'producer', film_id: '1', films: { id: '1', title: 'First Film', year: 2025, release_type: 'cinema' } },
  { role: 'actor', film_id: '2', films: { id: '2', title: 'Web Film', year: 2026, release_type: 'youtube' } },
];

describe('career passport model', () => {
  it('deduplicates productions while preserving verified credit count', () => {
    const model = buildCareerPassportModel({ person, credits, collaboratorCount: 9, baseUrl: 'https://muvidb.com/' });
    expect(model.productions).toBe(2);
    expect(model.credits).toBe(3);
    expect(model.collaborators).toBe(9);
    expect(model.formats).toEqual(expect.arrayContaining(['Cinema', 'YouTube']));
    expect(model.profileUrl).toBe('https://muvidb.com/people/ada-example');
    expect(model.claimed).toBe(true);
  });

  it('creates stable IDs, filenames and distinct share copy', () => {
    expect(getCareerPassportId(person)).toMatch(/^MVP-NG-\d{6}$/);
    expect(getCareerPassportId(person)).toBe(getCareerPassportId(person));
    expect(careerPassportFilename(person)).toBe('ada-example-career-passport.jpg');
    expect(careerPassportShareText(person, true)).toContain('my Career Passport');
    expect(careerPassportShareText(person, false)).toContain("Ada Example's Career Passport");
  });
});
