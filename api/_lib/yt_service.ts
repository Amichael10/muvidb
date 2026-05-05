
/**
 * Shared YouTube API utilities for lumi sync tasks.
 */

const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Generic YouTube API fetcher
 */
export async function ytGet(endpoint: string, params: Record<string, string>) {
  if (!YT_KEY) throw new Error('YOUTUBE_API_KEY is missing in environment');
  
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorBody = await res.text();
    let detail = errorBody;
    try {
      const json = JSON.parse(errorBody);
      detail = json.error?.message || errorBody;
    } catch (e) {}
    throw new Error(`YouTube /${endpoint} ${res.status}: ${detail}`);
  }
  return res.json();
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

/**
 * Advanced title cleaning for YouTube video titles
 * Strips marketing noise, years, and common Nollywood/Nigerian buzzwords.
 */
export function cleanTitle(raw: string): string {
  if (!raw) return raw;
  
  let title = raw.trim();

  // 1. Specific Nollywood/YouTube noise patterns
  title = title.replace(/\s*\/\s*[A-Z]{2,5}\.?\s*\/?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s*Watch\s+.*/i, '');
  title = title.replace(/\s+[-–—]\s*LATEST\s*.*/i, '');
  title = title.replace(/\s+[-–—]s\s*NEW\s*$/i, '');
  title = title.replace(/\s*#\w+/g, '');
  title = title.replace(/\s+[-–—]\s+(Nigerian|Nollywood|African).*/i, '');
  title = title.replace(/\s+[-–—](Nigerian|Nollywood|African).*/i, '');
  title = title.replace(/\s*Latest\s*(Nigerian|Nollywood|Yoruba|Igbo)?\s*(Epic\s*)?(New\s*)?(Drama\s*)?(Movie|Film|Movies|Films)s?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*[\/,]\s*[A-Z].*$/i, '');
  title = title.replace(/\s*(Full|Complete)\s*(Movie|Film|Season)\s*$/i, '');
  title = title.replace(/\s*\|\s*(Moments with Mo|MWM)\s*$/i, '');
  title = title.replace(/\s*\(Latest\s*(Comedy\s*)?(Drama\s*)?(Action\s*)?(Movie|Film|Movies|Films)\s*\)\s*$/i, '');

  // 2. Remove pipe-delimited segments and large bracketed text
  title = title.replace(/\|\|[^|]+\|\|/g, '').replace(/\([A-Z][A-Z\s,]{6,}\)/g, '').trim();

  // 3. Heuristic: if title is very long and has a dash, take the first part
  if (title.length > 80) {
    const dashParts = title.split(/\s+[-–—]\s+/);
    if (dashParts[0].length >= 3 && dashParts[0].length <= 70) {
      title = dashParts[0];
    }
  }

  // 4. Final polish
  title = title.replace(/\s{2,}/g, ' ').trim();
  title = title.replace(/\s*[,|]\s*$/, '').trim();
  title = title.replace(/\s+[-–—]\s*$/, '').trim();

  // 5. Title Case conversion (except for short acronyms)
  return title.split(/\s+/).map(w => {
    if (w.length <= 3 && w === w.toUpperCase() && /^[A-Z]+$/.test(w)) return w;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}
