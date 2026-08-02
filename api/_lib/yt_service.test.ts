import { describe, it, expect } from 'vitest';
import { cleanTitle } from './yt_service.js';

/**
 * Titles here are real uploads that collapsed onto one title in `films`,
 * letting a serial masquerade as a pile of duplicates.
 */
describe('cleanTitle', () => {
  it('keeps the episode number when the marker is written EPS', () => {
    // "EPS 6" used to be stripped as noise, so Ajifa episodes 3-6 all became
    // "Ajifa" and looked like four duplicate rows.
    const titles = [3, 4, 5, 6].map(n =>
      cleanTitle(`AJIFA- EPS ${n} LATEST COMEDY MOVIES 2024, OJOPAGOGO, AJANBADAN`));

    for (const [i, t] of titles.entries()) {
      expect(t).toMatch(new RegExp(`EPS\\s*${i + 3}`, 'i'));
    }
    expect(new Set(titles).size).toBe(4);
  });

  it('keeps PART markers, spaced or not', () => {
    expect(cleanTitle('OTAN HUNU  PART 1 // GHANAIAN MOVIES')).toMatch(/PART\s*1/i);
    expect(cleanTitle('TUMI MU TUMI PART2//FULL GHANA MOVIE')).toMatch(/PART\s*2/i);
  });

  it('keeps the Pt abbreviation', () => {
    expect(cleanTitle('Agatha The Village Corper Pt 2 - Mercy Johnson')).toMatch(/PT\s*2/i);
  });

  it('still keeps EPISODE and SEASON markers', () => {
    expect(cleanTitle('PAPA NO DEY REST Episode 3 // Ghanaian movies')).toMatch(/EPISODE\s*3/i);
    expect(cleanTitle('Best of Okele | Season 2 - Episode 1')).toMatch(/SEASON\s*2/i);
  });

  it('gives distinct titles to distinct episodes of one serial', () => {
    const parts = [1, 2, 3, 4, 5].map(n =>
      cleanTitle(`PAPA NO DEY REST Episode ${n} // OBENTEN THE LANDLORD // Ghanaian movies`));
    expect(new Set(parts).size).toBe(5);
  });

  it('does not invent a marker where the title has none', () => {
    expect(cleanTitle('THE CARER | UZOR ARUKWE | TENIOLA ALADESE')).not.toMatch(/\b(EPS?|PART|PT)\s*\d/i);
  });
});
