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
      expect(t).toMatch(new RegExp(`(?:EPS|EP)\\s*${i + 3}`, 'i'));
    }
    expect(new Set(titles).size).toBe(4);
  });

  it('keeps PART markers, spaced or not', () => {
    expect(cleanTitle('OTAN HUNU  PART 1 // GHANAIAN MOVIES')).toMatch(/PART\s*1/i);
    expect(cleanTitle('TUMI MU TUMI PART2//FULL GHANA MOVIE')).toMatch(/PART\s*2/i);
  });

  it('keeps the Pt abbreviation', () => {
    expect(cleanTitle('Agatha The Village Corper Pt 2 - Mercy Johnson')).toMatch(/(?:PT|Part)\s*2/i);
  });

  it('still keeps EPISODE and SEASON markers', () => {
    expect(cleanTitle('PAPA NO DEY REST Episode 3 // Ghanaian movies')).toMatch(/(?:EPISODE|Ep)\s*3/i);
    expect(cleanTitle('Best of Okele | Season 2 - Episode 1')).toMatch(/(?:SEASON\s*2|S2)/i);
  });

  it('gives distinct titles to distinct episodes of one serial', () => {
    const parts = [1, 2, 3, 4, 5].map(n =>
      cleanTitle(`PAPA NO DEY REST Episode ${n} // OBENTEN THE LANDLORD // Ghanaian movies`));
    expect(new Set(parts).size).toBe(5);
  });

  it('does not invent a marker where the title has none', () => {
    expect(cleanTitle('THE CARER | UZOR ARUKWE | TENIOLA ALADESE')).not.toMatch(/\b(EPS?|PART|PT)\s*\d/i);
  });

  it('correctly handles Flashback Movie titles', () => {
    const raw1 = 'FAAN TV - Flashback Movie: WAZO Part 1 | Full Yoruba Movie';
    const raw2 = 'Flashback Movie: WAZO Part 1 | Full Yoruba Movie';
    const raw3 = 'Flashback: MAKU (Part 2) | Funke Akindele, Femi Branch, Sola Kosoko';
    const raw4 = 'Flashback Movie - WAZO Part 2 (2) | Yoruba Nollywood | Funke Akindele, Odunlade Adekola,';

    expect(cleanTitle(raw1)).toBe('Wazo Part 1');
    expect(cleanTitle(raw2)).toBe('Wazo Part 1');
    expect(cleanTitle(raw3)).toBe('Maku Part 2');
    expect(cleanTitle(raw4)).toBe('Wazo Part 2');
  });

  it('runs curateYouTubeTitle', async () => {
    const { curateYouTubeTitle, isSensationalizedYouTubeTitle } = await import('./youtube_title_policy.js');
    const c1 = curateYouTubeTitle('FAAN TV - Flashback Movie: WAZO Part 1 | Full Yoruba Movie');
    expect(c1.action).toBe('clean');
    expect(c1.title).toBe('Wazo Part 1');

    const c2 = curateYouTubeTitle('How The Billionaire Took In The Homeless Single Mom He Saw With Her Baby At His Door');
    expect(c2.action).toBe('skip');
    expect(isSensationalizedYouTubeTitle('How The Billionaire Took In The Homeless Single Mom He Saw With Her Baby At His Door')).toBe(true);
  });
});
