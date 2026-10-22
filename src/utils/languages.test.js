import { describe, expect, it } from 'vitest';

import { getFilmLanguages, getLanguageEndonym } from './languages';

describe('getLanguageEndonym', () => {
  it('names a language the way its own speakers write it', () => {
    expect(getLanguageEndonym('Yoruba')).toEqual({ name: 'Yoruba', endonym: 'Yorùbá', label: 'Yorùbá' });
    expect(getLanguageEndonym('Swahili').label).toBe('Kiswahili');
  });

  it('keeps the noun-class prefix on Bantu names', () => {
    expect(getLanguageEndonym('Zulu').label).toBe('isiZulu');
    expect(getLanguageEndonym('Sotho').label).toBe('Sesotho');
  });

  it('resolves an ISO code before looking up the endonym', () => {
    expect(getLanguageEndonym('yo').label).toBe('Yorùbá');
    expect(getLanguageEndonym('pcm').label).toBe('Naijá');
  });

  it('reports no endonym when it matches the English name', () => {
    expect(getLanguageEndonym('Hausa')).toEqual({ name: 'Hausa', endonym: null, label: 'Hausa' });
    expect(getLanguageEndonym('English').endonym).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(getLanguageEndonym('')).toBeNull();
    expect(getLanguageEndonym(null)).toBeNull();
  });
});

describe('getFilmLanguages', () => {
  it('prefers the array and falls back to the legacy delimited string', () => {
    expect(getFilmLanguages({ languages: ['Yoruba', 'English'] })).toEqual(['Yoruba', 'English']);
    expect(getFilmLanguages({ language: 'English/Yoruba' })).toEqual(['English', 'Yoruba']);
    expect(getFilmLanguages({})).toEqual([]);
  });
});
