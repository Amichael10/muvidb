import { describe, expect, it } from 'vitest';

import { instalmentKey, normalizeTitleStrict, pickBestFilmMatch, titleMatchScore } from './yearbook_title_match';

/**
 * Each case here is a mis-assignment that actually reached production: one
 * yearbook figure written onto several unrelated films.
 */
describe('titleMatchScore', () => {
  it('refuses the substring matches that leaked a Nigerian gross onto foreign titles', () => {
    // "The Call" normalises to "call", which the old matcher found inside
    // "call of duty: black ops ii" and treated as the same film.
    expect(titleMatchScore('Call of Duty: Black Ops II', 'The Call')).toBeNull();
    expect(titleMatchScore('Pretty Little Liars: Original Sin', 'Toto: With a Little Help from My Friends')).toBeNull();
    expect(titleMatchScore('The Calling: A Medical School Journey', 'The Call')).toBeNull();
  });

  it('keeps sequels apart from their originals', () => {
    expect(titleMatchScore('Chief Daddy 2', 'Chief Daddy')).toBeNull();
    expect(titleMatchScore('Chief Daddy', 'Chief Daddy 2')).toBeNull();
    expect(titleMatchScore('Omo Ghetto the Saga (concluding Part)', 'Omo Ghetto: The Saga')).toBeNull();
  });

  it('still accepts genuine alternate titling', () => {
    expect(titleMatchScore('Agesinkole: King of Thieves', 'King of Thieves')).toBe(70);
    expect(titleMatchScore('King of Thieves', 'Agesinkole: King of Thieves')).toBe(70);
  });

  it('scores an exact match above an alternate titling', () => {
    expect(titleMatchScore('Omo Ghetto: The Saga', 'Omo Ghetto: The Saga')).toBe(100);
    expect(titleMatchScore('Omo Ghetto', 'Omo Ghetto: The Saga')).toBe(70);
  });

  it('ignores a leading "the" and trailing asterisks', () => {
    expect(normalizeTitleStrict('The Set Up**')).toBe('set up');
    expect(titleMatchScore('The Blood Covenant', 'Blood Covenant')).toBe(100);
  });
});

describe('instalmentKey', () => {
  it('reads digits, roman numerals and explicit parts', () => {
    expect(instalmentKey('chief daddy 2')).toBe('2');
    expect(instalmentKey('black ops iii')).toBe('3');
    expect(instalmentKey('alakada part 4')).toBe('4');
    expect(instalmentKey('omo ghetto the saga (concluding part)')).toBe('final');
  });

  it('treats a plain title as the first instalment', () => {
    expect(instalmentKey('chief daddy')).toBe('');
    expect(instalmentKey('king of thieves')).toBe('');
  });
});

describe('pickBestFilmMatch', () => {
  it('writes to the exact title rather than every loose match', () => {
    // The real failure: this figure landed on the anime too.
    const films = [
      { id: 'nollywood', title: 'Love Is War' },
      { id: 'anime', title: 'Kaguya-Sama: Love Is War' },
    ];
    const best = pickBestFilmMatch(films, { rawTitle: 'Love Is War' });
    expect(best?.film.id).toBe('nollywood');
    expect(best?.ambiguous).toBeUndefined();
  });

  it('uses the year to separate two films sharing a title', () => {
    const films = [
      { id: 'old', title: 'Malaika', year: 2011 },
      { id: 'new', title: 'Malaika', year: 2023 },
    ];
    expect(pickBestFilmMatch(films, { rawTitle: 'Malaika', year: 2023 })?.film.id).toBe('new');
    expect(pickBestFilmMatch(films, { rawTitle: 'Malaika', year: 2011 })?.film.id).toBe('old');
  });

  it('flags a tie as ambiguous instead of guessing', () => {
    const films = [
      { id: 'a', title: 'Woman King' },
      { id: 'b', title: 'Woman King' },
    ];
    expect(pickBestFilmMatch(films, { rawTitle: 'Woman King' })?.ambiguous).toBe(true);
  });

  it('returns null when nothing matches', () => {
    expect(pickBestFilmMatch([{ id: 'x', title: 'Call of Duty: Black Ops II' }], { rawTitle: 'The Call' })).toBeNull();
    expect(pickBestFilmMatch([], { rawTitle: 'Anything' })).toBeNull();
  });
});
