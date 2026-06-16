/**
 * Utility to detect if a title represents a series episode and normalize it.
 * Handles patterns like:
 *  - "Movie Name Ep 1", "Movie Name Ep 01", "Movie Name EP1"
 *  - "Movie Name Season 1 Episode 2", "Movie Name S01E02"
 *  - "Movie Name Part 1", "Movie Name Part II" (Roman numerals)
 *  - "Movie Name Chapter 1", "Movie Name Vol 3"
 *  - "Movie Name - Episode 1", "Movie Name: Ep1"
 */

const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10 };

function romanToInt(str: string): number | null {
  const upper = str.toUpperCase();
  const val = (ROMAN as any)[upper];
  return val !== undefined ? val : null;
}

export function detectAndNormalizeSeries(title: string) {
  const originalTitle = title;
  let clean = title.trim();

  // S01E02 / S1E2 pattern
  const sXeY = clean.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
  if (sXeY) {
    const baseTitle = clean.replace(/[\s:-]*S\d{1,2}E\d{1,3}.*/i, '').trim();
    return {
      isSeries: true,
      baseTitle,
      seasonNum: parseInt(sXeY[1]),
      episodeNum: parseInt(sXeY[2]),
      originalTitle
    };
  }

  // "Episode N" / "Ep N" / "EP N" / "EP.N"
  const epRegex = /\b(?:ep\.?|episode)\s*(\d{1,3})\b/i;
  const epMatch = clean.match(epRegex);
  if (epMatch) {
    const baseTitle = clean.replace(epRegex, '')
      .replace(/[\s:–\-]+$/, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .trim();
    return {
      isSeries: true,
      baseTitle,
      seasonNum: null,
      episodeNum: parseInt(epMatch[1]),
      originalTitle
    };
  }

  // "Season N" with optional "Episode M"
  const seasonRegex = /\bseason\s*(\d{1,2})(?:[\s,]+episode\s*(\d{1,3}))?\b/i;
  const seasonMatch = clean.match(seasonRegex);
  if (seasonMatch) {
    const baseTitle = clean.replace(seasonRegex, '')
      .replace(/[\s:–\-]+$/, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\[\s*\]/g, '')
      .trim();
    return {
      isSeries: true,
      baseTitle,
      seasonNum: parseInt(seasonMatch[1]),
      episodeNum: seasonMatch[2] ? parseInt(seasonMatch[2]) : null,
      originalTitle
    };
  }

  // "Part N" or "Part II" - USER REQUEST: Parts 1 and 2 are regular movies, do not treat as series.
  // We removed the partRegex matching here.

  // Broad markers: title contains "seasons", "episodes", "series" as standalone words
  if (/\b(seasons|episodes|series)\b/i.test(clean)) {
    return {
      isSeries: true,
      baseTitle: clean.replace(/[\s:–\-]*\b(seasons?|episodes?|series)\b.*/i, '').trim() || clean,
      seasonNum: null,
      episodeNum: null,
      originalTitle
    };
  }

  return {
    isSeries: false,
    baseTitle: clean,
    seasonNum: null,
    episodeNum: null,
    originalTitle
  };
}

/**
 * Normalize a base title by removing trailing "Season/Series" markers.
 * e.g., "Blood Sisters: Season 2" → "Blood Sisters"
 */
export function normalizeSeriesTitle(title: string): string {
  return title
    .replace(/[\s:–\-]+season\s*\d+.*/i, '')
    .replace(/[\s:–\-]+series\s*\d+.*/i, '')
    .replace(/[\s:–\-]+part\s*\d+.*/i, '')
    .trim();
}
