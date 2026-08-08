import { describe, expect, it } from 'vitest';
import { firstUsableCopy, isLikelyFilmTitle, isUsableCopy } from './copy-quality';

describe('isUsableCopy', () => {
  it('accepts ordinary prose', () => {
    expect(isUsableCopy('A retired warrior is pulled back into a fight he swore to leave behind.')).toBe(true);
  });

  it('rejects a scraped hashtag dump', () => {
    // Real shape seen in films.synopsis for YouTube-sourced titles.
    expect(isUsableCopy('#ganielewure #tokunbomalvins #apankufor #tosinolaniyan #yinkadolomon #midemartins')).toBe(false);
  });

  it('rejects prose that is mostly trailing tags', () => {
    expect(isUsableCopy('Watch now #nollywood #movie #drama #action #2026 #newrelease')).toBe(false);
  });

  it('rejects link bait', () => {
    expect(isUsableCopy('https://example.com/watch https://example.com/sub https://example.com/x')).toBe(false);
  });

  it('rejects empty, null and very short values', () => {
    expect(isUsableCopy(null)).toBe(false);
    expect(isUsableCopy(undefined)).toBe(false);
    expect(isUsableCopy('   ')).toBe(false);
    expect(isUsableCopy('Great film')).toBe(false);
  });

  it('accepts a short tagline', () => {
    // Taglines are legitimately terse; only hashtag/link noise should be cut.
    expect(isUsableCopy('A warrior never kneels.')).toBe(true);
  });

  it('tolerates a single trailing hashtag on real prose', () => {
    expect(isUsableCopy('A warrior returns home to find his village burned to the ground. #Nollywood')).toBe(true);
  });
});

describe('isLikelyFilmTitle', () => {
  it('accepts real film titles', () => {
    for (const title of ['Jagun Jagun', 'Lisabi: The Uprising', 'Aníkúlápó', 'King of Boys']) {
      expect(isLikelyFilmTitle(title)).toBe(true);
    }
  });

  it('rejects the harvested non-film titles seen on real credits', () => {
    // All three are published credits on a real person in the database.
    expect(isLikelyFilmTitle('Interview and Behind the Scene')).toBe(false);
    expect(isLikelyFilmTitle('Interview and Appreciation')).toBe(false);
    expect(
      isLikelyFilmTitle('Interview - Knowing Your Favorite Acts of Saamu Alajo PT 2 ( Saamu Alajo Crew)'),
    ).toBe(false);
  });

  it('rejects other clip formats', () => {
    for (const title of ['Official Trailer', 'BTS on set', 'Making of the film', 'Cast Reactions', 'Bloopers']) {
      expect(isLikelyFilmTitle(title)).toBe(false);
    }
  });

  it('keeps "Full Movie", which is how many genuine titles are published', () => {
    expect(isLikelyFilmTitle('Omoni Full Movie')).toBe(true);
  });

  it('does not swallow real titles that merely contain a keyword', () => {
    // "A Chain Reaction" is a genuine film in the catalogue; an unbounded
    // /reaction/ rejected it.
    expect(isLikelyFilmTitle('A Chain Reaction')).toBe(true);
    expect(isLikelyFilmTitle('Celebrity Reactions to Chuck Norris\' Death')).toBe(false);
  });

  it('rejects an overlong harvested headline', () => {
    expect(isLikelyFilmTitle('A'.repeat(80))).toBe(false);
  });

  it('rejects empty and missing titles', () => {
    expect(isLikelyFilmTitle(null)).toBe(false);
    expect(isLikelyFilmTitle('   ')).toBe(false);
  });
});

describe('firstUsableCopy', () => {
  it('returns the first usable candidate and trims it', () => {
    expect(firstUsableCopy('  #junk #tags #only #here  ', '  A proper synopsis of the film.  ')).toBe(
      'A proper synopsis of the film.',
    );
  });

  it('returns null when nothing is usable', () => {
    expect(firstUsableCopy(null, '#a #b #c', '')).toBeNull();
  });
});
