
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

  // 1. Season info (e.g., SEASON 1, S2, S02E05)
  let seasonNumber: number | null = null;
  const sPatternMatch = str.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
  let sPatternEp: number | null = null;
  if (sPatternMatch) {
    seasonNumber = parseInt(sPatternMatch[1], 10);
    sPatternEp = parseInt(sPatternMatch[2], 10);
  } else {
    const seasonMatch = str.match(/\b(?:SEASON|SN|S)\s*(\d+)\b/i);
    if (seasonMatch) {
      seasonNumber = parseInt(seasonMatch[1], 10);
    }
  }

  // 2. Episode info (EP 1, EPISODE 267, etc.)
  let episodeNumber: number | null = sPatternEp;
  if (episodeNumber == null) {
    const epMatch = str.match(/\b(?:EPISODE|EPS|EP\.|EP|E)\s*(\d+)\b/i);
    if (epMatch) {
      episodeNumber = parseInt(epMatch[1], 10);
    }
  }

  // 3. Part info (Movies with parts: PART 1, PT 2, PART 1 & 2, CONCLUDING PART)
  let isPart = false;
  let partStr: string | null = null;
  let partNumber: number | null = null;

  const comboPartMatch = str.match(/\b(?:PART|PT\.?)\s*(\d+)\s*(?:&|AND|\+)\s*(?:PART|PT\.?)?\s*(\d+)\b/i);
  if (comboPartMatch) {
    isPart = true;
    partStr = `Part ${comboPartMatch[1]} & ${comboPartMatch[2]}`;
  } else {
    const singlePartMatch = str.match(/\b(?:PART|PT\.?)\s*(\d+)\b/i);
    if (singlePartMatch) {
      isPart = true;
      partNumber = parseInt(singlePartMatch[1], 10);
      partStr = `Part ${singlePartMatch[1]}`;
      if (/\bCONCLUDING\s+PART\b/i.test(str)) {
        partStr = `Part ${singlePartMatch[1]} (Concluding Part)`;
      }
    } else if (/\bCONCLUDING\s+PART\b/i.test(str)) {
      isPart = true;
      partStr = '(Concluding Part)';
    }
  }

  // 4. Episode Subtitle in parentheses e.g. "SAAMU ALAJO (ALAGBADO) Latest 2026 EP 267"
  let episodeSubtitle: string | null = null;
  const parenMatch = str.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inner = parenMatch[1].trim();
    const isNoiseParen = /^(?:latest|full\s+movie|new|20\d{2}|official|hd|yoruba\s+movie|nollywood|action|comedy|drama|concluding\s+part|english|yoruba|igbo|hausa|pidgin|subtitled|subtitles|french)\b/i.test(inner);
    const isEpOrPart = /^(?:part|pt|ep|episode|season|s)\s*\d+/i.test(inner);
    if (!isNoiseParen && !isEpOrPart && inner.length >= 2 && inner.length <= 50) {
      let sub = inner.replace(/^(?:the\s+)?latest\s+/i, '').trim();
      const subPartMatch = str.match(new RegExp(`\\(${inner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\s*(\\d+)`));
      if (subPartMatch) {
        sub = `${sub} Pt ${subPartMatch[1]}`;
      }
      episodeSubtitle = formatTitleCase(sub);
    }
  }

  // Also check for subtitle separated by hyphen/colon before episode: e.g. "Saamu Alajo - Alagbado Ep 267"
  if (!episodeSubtitle && (episodeNumber != null || seasonNumber != null)) {
    const dashSubMatch = str.match(/^([^|:–—\-]+?)\s*[:–—\-]\s*([^|:–—\-]+?)\s+(?:[-–—|]\s*)?(?:SEASON|SN|S|EPISODE|EPS|EP\.|EP)\s*\d+/i);
    if (dashSubMatch) {
      const candSub = dashSubMatch[2].trim();
      const isNoise = /^(?:latest|new|official|trailer|teaser|yoruba|nollywood|movie|film|season|episode|drama|comedy)\b/i.test(candSub);
      if (!isNoise && candSub.length >= 2 && candSub.length <= 40) {
        episodeSubtitle = formatTitleCase(candSub);
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

  base = base.replace(/\s*\/.*$/, ''); // strip slash cast chains
  base = base.replace(/^(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(?:LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(?:MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(?:\d{4})?\s*[-–—:]\s*/i, '');
  base = base.replace(/\s*\[[^\]]+\]/g, '');
  base = base.replace(/\s*\{[^}]+\}/g, '');
  base = base.replace(/\s*\([^)]*\)/g, '');
  base = base.replace(/\s+[-–—]\s*(?:Latest|New|Nigerian|Nollywood|Yoruba|African|Watch|Ft\.|Starring|Featuring|Full\s+Nollywood\s+Movie|Full\s+Movie).*/i, '');
  base = base.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+.*$/i, ''); // star chains
  base = base.replace(/\s*(?:Latest|New|Full)\s*(?:Nigerian|Nollywood|Yoruba|Igbo)?\s*(?:Epic|Drama|Comedy|Action|Romance)?\s*(?:Movie|Film|Movies|Films|Series|Comedy Series)?\s*(?:\d{4})?.*$/i, '');
  base = base.replace(/\bS\d{1,2}E\d{1,3}.*$/i, '').trim();
  base = base.replace(/\b(?:EPISODE|EPS|EP\.|EP|SEASON|S|PART|PT\.?|VOLUME|VOL|E|V)\s*\d+.*$/i, '').trim();
  base = base.replace(/\bCONCLUDING\s+PART.*$/i, '').trim();

  // If subtitle was detected via dash, extract base from before dash (only for series)
  const isSeriesCheck = Boolean(episodeNumber != null || seasonNumber != null);
  if (isSeriesCheck && episodeSubtitle && /[:–—\-]/.test(base)) {
    const splitBase = base.split(/[:–—\-]/)[0].trim();
    if (splitBase.length >= 3) {
      base = splitBase;
    }
  }

  base = base.replace(/^[–—\-:, ]+|[–—\-:, ]+$/g, '').trim();
  // Strip trailing isolated numbers if they were already parsed in subtitle or episode
  if (episodeSubtitle || episodeNumber != null || isPart) {
    base = base.replace(/\s+\d+\s*$/, '').trim();
  }
  base = formatTitleCase(base);

  const isSeries = Boolean(episodeNumber != null || seasonNumber != null);
  const contentType = isSeries ? 'series' : 'movie';

  // 6. Build the standardized final title
  let finalTitle = base;

  if (isSeries) {
    const seasonTag = (seasonNumber && seasonNumber > 1) ? `S${seasonNumber} ` : '';
    const subTag = (episodeSubtitle && episodeSubtitle.toLowerCase() !== base.toLowerCase()) ? `(${episodeSubtitle}) ` : '';
    
    if (subTag || seasonTag) {
      finalTitle = `${base} ${subTag}${seasonTag}Ep ${episodeNumber || 1}`.replace(/\s+/g, ' ').trim();
    } else if (partStr && partStr.toLowerCase() !== base.toLowerCase()) {
      finalTitle = `${base} ${partStr} Ep ${episodeNumber || 1}`.replace(/\s+/g, ' ').trim();
    } else if (episodeNumber != null) {
      finalTitle = `${base} Ep ${episodeNumber}`;
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
    is_part: isPart,
    part_number: partNumber,
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
