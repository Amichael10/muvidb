
/**
 * Shared YouTube API utilities for muvidb sync tasks.
 */

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

// Collect every configured YouTube API key. Supports a comma-separated list in
// YOUTUBE_API_KEY and numbered fallbacks (YOUTUBE_API_KEY_2 … _10). Each key
// carries its own daily quota, so rotating across them multiplies the ceiling.
function collectYtKeys(): string[] {
  const raw: (string | undefined)[] = [
    process.env.YOUTUBE_API_KEY,
    process.env.VITE_YOUTUBE_API_KEY,
  ];
  for (let i = 2; i <= 10; i++) raw.push(process.env[`YOUTUBE_API_KEY_${i}`]);
  return [
    ...new Set(
      raw.filter(Boolean).flatMap((k) => k!.split(',')).map((k) => k.trim()).filter(Boolean)
    ),
  ];
}

let ytKeyIdx = 0; // persists across calls so we stay on a working key

// A key is "dead" (rotate to the next one) when it's quota-exhausted (403) OR
// rejected as invalid (400). Both mean this key can't serve the request, so we
// should fall through to the next configured key — restoring the old
// `YOUTUBE_API_KEY || VITE_YOUTUBE_API_KEY` fallback behaviour.
function isDeadKeyError(status: number, body: string): boolean {
  if (status === 403 && /quotaExceeded|dailyLimitExceeded|rateLimitExceeded|userRateLimitExceeded/i.test(body)) return true;
  if (status === 400 && /API key not valid|API_KEY_INVALID|keyInvalid/i.test(body)) return true;
  return false;
}

/**
 * Generic YouTube API fetcher with automatic key rotation. Rotates to the next
 * configured key when the current one is quota-exhausted or invalid.
 */
export async function ytGet(endpoint: string, params: Record<string, string>): Promise<any> {
  const keys = collectYtKeys();
  if (!keys.length) throw new Error('No YouTube API key configured (YOUTUBE_API_KEY)');

  let lastDetail = '';
  // Try each key at most once per call, starting from the current one.
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[ytKeyIdx % keys.length];
    const url = new URL(`${YT_BASE}/${endpoint}`);
    Object.entries({ ...params, key }).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
    if (res.ok) return res.json();

    const body = await res.text();
    let detail = body;
    try { detail = JSON.parse(body).error?.message || body; } catch (e) {}

    if (isDeadKeyError(res.status, body) && keys.length > 1) {
      console.warn(`[ytGet] key #${(ytKeyIdx % keys.length) + 1}/${keys.length} unusable (${res.status}), rotating…`);
      ytKeyIdx = (ytKeyIdx + 1) % keys.length;
      lastDetail = detail;
      continue; // retry with the next key
    }
    // Genuine request error (404/bad params/etc.) — fail fast, rotating won't help.
    throw new Error(`YouTube /${endpoint} ${res.status}: ${detail}`);
  }
  throw new Error(`All ${keys.length} YouTube API key(s) exhausted or invalid. Last error: ${lastDetail}`);
}

/**
 * Parses ISO 8601 duration (e.g. PT1H2M10S) to seconds
 */
export function parseDuration(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  const s = parseInt(iso.match(/(\d+)S/)?.[1] ?? '0');
  return h * 3600 + m * 60 + s;
}

export interface ParsedTitleMetadata {
  title: string;
  content_type: 'movie' | 'series';
  episode_number: number | null;
  season_number: number | null;
  is_part: boolean;
  part_number: number | null;
}

const WORD_TO_NUMBER: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
  'twenty one': 21, 'twenty-one': 21, 'twenty two': 22, 'twenty-two': 22, 'twenty three': 23, 'twenty-three': 23,
  'twenty four': 24, 'twenty-four': 24, 'twenty five': 25, 'twenty-five': 25, 'twenty six': 26, 'twenty-six': 26,
  'twenty seven': 27, 'twenty-seven': 27, 'twenty eight': 28, 'twenty-eight': 28, 'twenty nine': 29, 'twenty-nine': 29,
  thirty: 30, 'thirty one': 31, 'thirty two': 32, 'thirty three': 33, 'thirty four': 34, 'thirty five': 35,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

const ROMAN_NUMERALS: Record<string, number> = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10,
  xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20,
  xxi: 21, xxii: 22, xxiii: 23, xxiv: 24, xxv: 25, xxvi: 26, xxvii: 27, xxviii: 28, xxix: 29, xxx: 30,
  xxxi: 31, xxxii: 32, xxxiii: 33, xxxiv: 34, xxxv: 35, xxxvi: 36, xxxvii: 37, xxxviii: 38, xxxix: 39, xl: 40,
  l: 50,
};

export function parseNumberToken(token: string): number | null {
  if (!token) return null;
  const clean = token.toLowerCase().trim();
  if (/^\d+$/.test(clean)) return parseInt(clean, 10);
  if (WORD_TO_NUMBER[clean] !== undefined) return WORD_TO_NUMBER[clean];
  if (ROMAN_NUMERALS[clean] !== undefined) return ROMAN_NUMERALS[clean];
  return null;
}

export const KNOWN_SERIES = [
  'abattoir', 'saamu alajo', "jenifa's diary", 'jenifas diary', 'aiyetoro town',
  'my siblings and i', 'she must be obeyed', 'abejoye', 'eniyan egun', 'gbemi',
  'the train', 'papa ajasco', 'professor johnbull', 'skinny girl in transit',
  'the johnsons', 'flatmates', 'officer titus', "the men's club", 'the mens club',
  'dear queen', 'onyeka the local hustler', 'once upon a village', 'bakayoko',
  'family game', "adaobi's trial", 'adaobis trial', 'the voice', 'industreet',
  'prayerquake', 'prayer quake', 'drama ministers', 'vision carriers', 'ile ariwo',
  'shackles', 'jailer', 'legion',
];

function toTitleCaseWord(w: string, i: number, allWords: string[]): string {
  const upper = w.toUpperCase();
  const minorWords = ['A', 'AN', 'THE', 'AND', 'BUT', 'OR', 'FOR', 'NOR', 'ON', 'AT', 'TO', 'BY', 'OF', 'IN', 'WITH', 'FROM', 'AS'];
  const preservedAcronyms = ['EP', 'EPS', 'EPISODE', 'SEASON', 'PART', 'PT', 'VOL', 'VOLUME', 'HD', 'UK', 'USA', 'NG', 'TV', 'VIP', 'FBI', 'BBC'];

  if (preservedAcronyms.includes(upper)) {
    if (upper === 'PT') return 'Part';
    if (upper === 'EP' || upper === 'EPS') return 'Ep';
    if (['HD', 'UK', 'USA', 'NG', 'TV', 'VIP', 'FBI', 'BBC'].includes(upper)) return upper;
    return upper.charAt(0) + upper.slice(1).toLowerCase();
  }
  if (minorWords.includes(upper) && i !== 0 && i !== allWords.length - 1) {
    return w.toLowerCase();
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export function formatTitleCase(str: string): string {
  if (!str) return '';
  const words = str.trim().split(/\s+/);
  return words.map((w, i) => toTitleCaseWord(w, i, words)).join(' ');
}

/**
 * Parses raw title and extracts clean title, series/movie content_type,
 * episode_number, season_number, and part metadata.
 */
export function parseTitleMetadata(raw: string): ParsedTitleMetadata {
  if (!raw) {
    return {
      title: '',
      content_type: 'movie',
      episode_number: null,
      season_number: null,
      is_part: false,
      part_number: null,
    };
  }

  let str = raw.trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ');

  // 1. Season & Episode combined pattern (e.g. S2EP1, S1EP12, S2EP05, S02E05, S2 EP 3, SEASON 1)
  let seasonNumber: number | null = null;
  const sPatternMatch = str.match(/\bS(\d{1,2})\s*(?:EP|E)\s*(\d{1,3})\b/i);
  let sPatternEp: number | null = null;
  if (sPatternMatch) {
    seasonNumber = parseInt(sPatternMatch[1], 10);
    sPatternEp = parseInt(sPatternMatch[2], 10);
  } else {
    const seasonMatch = str.match(/\b(?:SEASON|SN)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[ivxlcdm]+)\b/i)
      || str.match(/\bS\s*(\d{1,2})\b/i);
    if (seasonMatch) {
      seasonNumber = parseNumberToken(seasonMatch[1]);
    }
  }

  // 2. Episode combo (e.g. EPISODE 7 & 8, EP 1 AND 2, EPISODES 1-3)
  let episodeComboStr: string | null = null;
  let episodeNumber: number | null = sPatternEp;
  const epComboMatch = str.match(/\b(?:EPISODES?|EPS?|EP\.?)\s*(\d+)\s*(?:&|AND|\+|-)\s*(?:EPISODES?|EPS?|EP\.?)?\s*(\d+)\b/i);
  if (epComboMatch) {
    episodeNumber = parseInt(epComboMatch[1], 10);
    episodeComboStr = `Ep ${epComboMatch[1]} & ${epComboMatch[2]}`;
  } else if (episodeNumber == null) {
    // Episode info (EP 1, EPISODE 267, EPISODE NINE, EPISODE III, etc.)
    const numWordsPattern = '\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|twenty[- ]one|twenty[- ]two|twenty[- ]three|twenty[- ]four|twenty[- ]five|twenty[- ]six|twenty[- ]seven|twenty[- ]eight|twenty[- ]nine|thirty|forty|fifty|[ivxlcdm]+';
    const epMatch = str.match(new RegExp(`\\b(?:EPISODES?|EPS?|EP\\.?)\\s*(${numWordsPattern})\\b`, 'i'))
      || str.match(new RegExp(`\\bE\\s*(\\d{1,3})\\b`, 'i'));
    if (epMatch) {
      episodeNumber = parseNumberToken(epMatch[1]);
    }
  }

  // 3. Part info (Movies with parts: PART 1, PT 2, PART 1 & 2, PART TWO, CONCLUDING PART)
  let isPart = false;
  let partStr: string | null = null;
  let partNumber: number | null = null;

  const comboPartMatch = str.match(/\b(?:PART|PT\.?)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:&|AND|\+)\s*(?:PART|PT\.?)?\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i);
  if (comboPartMatch) {
    isPart = true;
    const p1 = parseNumberToken(comboPartMatch[1]) || comboPartMatch[1];
    const p2 = parseNumberToken(comboPartMatch[2]) || comboPartMatch[2];
    partStr = `Part ${p1} & ${p2}`;
  } else {
    const singlePartMatch = str.match(/\b(?:PART|PT\.?)\s*(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|[ivxlcdm]+)\b/i);
    if (singlePartMatch) {
      isPart = true;
      partNumber = parseNumberToken(singlePartMatch[1]);
      partStr = `Part ${partNumber || singlePartMatch[1]}`;
      if (/\bCONCLUDING\s+PART\b/i.test(str)) {
        partStr = `Part ${partNumber || singlePartMatch[1]} (Concluding Part)`;
      }
    } else if (/\bCONCLUDING\s+PART\b/i.test(str)) {
      isPart = true;
      partStr = '(Concluding Part)';
    }
  }

  // 4. Episode Subtitle
  let episodeSubtitle: string | null = null;
  // A. In parentheses e.g. "SAAMU ALAJO (ALAGBADO) Latest 2026 EP 267"
  const parenMatches = [...str.matchAll(/\(([^)]+)\)/g)];
  for (const pm of parenMatches) {
    const inner = pm[1].trim();
    const isNoiseParen = /^(?:latest|full\s+movie|new|20\d{2}|official|hd|yoruba\s+movie|nollywood|action|comedy|drama|concluding\s+part|english|yoruba|igbo|hausa|pidgin|subtitled|subtitles|french)\b/i.test(inner);
    const isOnlyEpOrPart = /^(?:part|pt|ep|episode|season|s)\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|[ivxlcdm]+)$/i.test(inner);
    if (!isNoiseParen && !isOnlyEpOrPart && inner.length >= 2 && inner.length <= 50) {
      let sub = inner.replace(/^(?:the\s+)?latest\s+/i, '').trim();
      sub = sub.replace(/\s*(?:[-–—:]\s*)?(?:\b(?:episode|ep|season)\b|\bS\d+)\s*[\w\d]*/i, '').trim();
      if (sub.length >= 2) {
        episodeSubtitle = formatTitleCase(sub);
        break;
      }
    }
  }

  // B. Subtitle after dash/colon (e.g. "Saamu Alajo - Alagbado Ep 267" or "Series Ep 4: The Revelation")
  if (!episodeSubtitle && (episodeNumber != null || seasonNumber != null)) {
    const dashBeforeEp = str.match(/^([^|:–—\-]+?)\s*[:–—\-]\s*([^|:–—\-]+?)\s+(?:[-–—|]\s*)?(?:SEASON|SN|S|EPISODE|EPS|EP\.|EP)\s*[\w\d]+/i);
    if (dashBeforeEp) {
      const candSub = dashBeforeEp[2].trim();
      const isNoise = /^(?:latest|new|official|trailer|teaser|yoruba|nollywood|movie|film|season|episode|drama|comedy)\b/i.test(candSub);
      if (!isNoise && candSub.length >= 2 && candSub.length <= 40) {
        episodeSubtitle = formatTitleCase(candSub);
      }
    } else {
      const dashAfterEp = str.match(/(?:EPISODE|EPS|EP\.|EP)\s*[\w\d]+\s*[:–—\-]\s*([^|–—\-]+)/i);
      if (dashAfterEp) {
        const candSub = dashAfterEp[1].trim().replace(/\s*(?:Latest|New|Nigerian|Nollywood|Yoruba).*/i, '').trim();
        const isNoise = /^(?:latest|new|official|trailer|teaser|yoruba|nollywood|movie|film|season|episode|drama|comedy)\b/i.test(candSub);
        if (!isNoise && candSub.length >= 2 && candSub.length <= 40) {
          episodeSubtitle = formatTitleCase(candSub);
        }
      }
    }
  }

  // 5. Clean core base name
  let base = str;
  if (base.includes('|')) {
    const segments = base.split(/\|+/).map(s => s.trim()).filter(Boolean);
    if (segments.length > 1) {
      const isActorOrTeaser = (seg: string) => {
        const hasActorConnector = /\b(?:&|and|featuring|starring|ft\.)\b/i.test(seg);
        const hasColonTeaser = /[:–—\-]/.test(seg);
        const hasStoryVerb = /\b(?:vanishes|disappears|betrays|cries|shocked|revenge|falls in love)\b/i.test(seg);
        return (hasActorConnector && hasColonTeaser) || hasStoryVerb;
      };

      const hasMovieTag = (seg: string) => {
        return /\b(?:full\s+(?:nollywood|nigerian|yoruba)?\s*movie|latest\s+movie|complete\s+movie)\b/i.test(seg);
      };

      if (isActorOrTeaser(segments[0]) && (hasMovieTag(segments[1]) || !isActorOrTeaser(segments[1]))) {
        base = segments[1];
      } else if (hasMovieTag(segments[0]) || !isActorOrTeaser(segments[0])) {
        base = segments[0];
      } else {
        base = segments[0];
      }
    } else {
      base = segments[0] || base;
    }
  }

  // Channel watermarks & promotional noise
  base = base.replace(/\b(?:uchenancy|uche\s*nancy)\b(?:\s+hit\s+movie)?/gi, '');
  base = base.replace(/\s*\/.*$/, ''); // strip slash cast chains
  base = base.replace(/^(?:[A-Za-z0-9_\s]{2,20}\s+[-–—:]\s*)?(?:FLASHBACK\s+(?:MOVIE|FILM)?|FLASHBACK)\s*[-–—:]\s*/i, '');
  base = base.replace(/^(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(?:MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(?:\d{4})?\s*[-–—:]\s*/i, '');
  base = base.replace(/\s*\[[^\]]+\]/g, '');
  base = base.replace(/\s*\{[^}]+\}/g, '');
  base = base.replace(/\s*\([^)]*\)/g, '');
  base = base.replace(/\s+[-–—]\s*(?:Latest|New|Nigerian|Nollywood|Yoruba|African|Watch|Ft\.|Starring|Featuring|Full\s+Nollywood\s+Movie|Full\s+Movie).*/i, '');
  base = base.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/i, ''); // star chains
  base = base.replace(/\s*(?:Latest|New|Full)\s*(?:Nigerian|Nollywood|Yoruba|Igbo)?\s*(?:Epic|Drama|Comedy|Action|Romance)?\s*(?:Movie|Film|Movies|Films|Series|Comedy Series)?\s*(?:\d{4})?.*$/i, '');
  base = base.replace(/\bS\d{1,2}\s*(?:EP|E)\s*\d{1,3}.*$/i, '').trim();
  base = base.replace(/\b(?:EPISODES?|EPS?|EP\.?|SEASON|SN|PART|PT\.?|VOLUME|VOL)\s*(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|[ivxlcdm]+).*$/i, '').trim();
  base = base.replace(/\b[SEV]\d+\b.*$/i, '').trim();
  base = base.replace(/\bCONCLUDING\s+PART.*$/i, '').trim();

  // If subtitle was detected via dash, extract base from before dash
  if ((episodeNumber != null || seasonNumber != null) && episodeSubtitle && /[:–—\-]/.test(base)) {
    const splitBase = base.split(/[:–—\-]/)[0].trim();
    if (splitBase.length >= 3) {
      base = splitBase;
    }
  }

  base = base.replace(/^[–—\-:, ]+|[–—\-:, ]+$/g, '').trim();
  if (episodeSubtitle || episodeNumber != null || isPart) {
    base = base.replace(/\s+\d+\s*$/, '').trim();
  }
  base = formatTitleCase(base);

  // Check known series
  const lowerBase = base.toLowerCase();
  const isKnownSeries = KNOWN_SERIES.some(ks => lowerBase === ks || lowerBase.startsWith(ks + ' ') || lowerBase.endsWith(' ' + ks));
  const isSeries = Boolean(episodeNumber != null || seasonNumber != null || isKnownSeries);
  const contentType = isSeries ? 'series' : 'movie';

  // 6. Build the standardized final title
  let finalTitle = base;

  if (isSeries) {
    const seasonTag = (seasonNumber && seasonNumber > 1) ? `S${seasonNumber} ` : '';
    const subTag = (episodeSubtitle && episodeSubtitle.toLowerCase() !== base.toLowerCase()) ? `(${episodeSubtitle}) ` : '';
    let epDisplay = episodeComboStr || (episodeNumber != null ? `Ep ${episodeNumber}` : '');
    if (epDisplay && isPart && partStr) {
      epDisplay = `${epDisplay} (${partStr})`;
    }

    if (epDisplay) {
      finalTitle = `${base} ${subTag}${seasonTag}${epDisplay}`.replace(/\s+/g, ' ').trim();
    } else if (subTag || seasonTag) {
      finalTitle = `${base} ${subTag}${seasonTag}`.replace(/\s+/g, ' ').trim();
    } else if (partStr && partStr.toLowerCase() !== base.toLowerCase()) {
      finalTitle = `${base} ${partStr}`.replace(/\s+/g, ' ').trim();
    }
  } else if (isPart && partStr) {
    if (partStr === '(Concluding Part)') {
      finalTitle = `${base} (Concluding Part)`;
    } else {
      finalTitle = `${base} ${partStr}`;
    }
  }

  return {
    title: finalTitle || formatTitleCase(str),
    content_type: contentType,
    season_number: isSeries ? (seasonNumber || 1) : null,
    episode_number: episodeNumber,
    is_part: isSeries ? false : isPart,
    part_number: isSeries ? null : partNumber,
  };
}

/**
 * Advanced title cleaning for YouTube video titles
 * Standardizes multi-part movies ("Title Part X") and episodic series ("Series (Subtitle) Ep X").
 */
export function cleanTitle(raw: string): string {
  if (!raw) return raw;
  const parsed = parseTitleMetadata(raw);
  return parsed.title;
}
