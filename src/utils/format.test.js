import { describe, it, expect } from 'vitest';
import {
  formatNaira,
  formatViews,
  formatFilmTitle,
  formatPersonName,
  formatLanguage,
  toSentenceCase,
  toTitleCase,
} from './format';

describe('format utilities', () => {
  describe('formatNaira', () => {
    it('returns fallback dash for null/undefined/0/invalid values', () => {
      expect(formatNaira(null)).toBe('—');
      expect(formatNaira(undefined)).toBe('—');
      expect(formatNaira(0)).toBe('—');
      expect(formatNaira('abc')).toBe('—');
    });

    it('formats standard values properly', () => {
      expect(formatNaira(50000)).toBe('₦50,000');
      expect(formatNaira(1500000)).toBe('₦1.5 Million');
      expect(formatNaira(2350000000)).toBe('₦2.35 Billion');
    });

    it('formats compact values when requested', () => {
      expect(formatNaira(50000, { compact: true })).toBe('₦50K');
      expect(formatNaira(1500000, { compact: true })).toBe('₦1.5M');
      expect(formatNaira(2350000000, { compact: true })).toBe('₦2.35B');
    });
  });

  describe('formatViews', () => {
    it('formats view counts appropriately', () => {
      expect(formatViews(null)).toBe('—');
      expect(formatViews(500)).toBe('500 Views');
      expect(formatViews(15000)).toBe('15.0K Views');
      expect(formatViews(25000000)).toBe('25.0M Views');
      expect(formatViews(1500000000)).toBe('1.50B Views');
    });
  });

  describe('title & name formatting', () => {
    it('converts ALL-CAPS titles properly while preserving intentional mixed-case', () => {
      expect(formatFilmTitle('JAGUN JAGUN')).toBe('Jagun Jagun');
      expect(formatFilmTitle('A Tribe Called Judah')).toBe('A Tribe Called Judah');
      expect(formatPersonName('FUNKE AKINDELE')).toBe('Funke Akindele');
    });

    it('formats languages with map or title case', () => {
      expect(formatLanguage('yo')).toBe('Yoruba');
      expect(formatLanguage('ig')).toBe('Igbo');
      expect(formatLanguage('pcm')).toBe('Nigerian Pidgin');
      expect(formatLanguage('eng')).toBe('English');
    });
  });
});
