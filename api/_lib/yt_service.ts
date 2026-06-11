
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
  
  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(30000)
  });
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
  
  let title = raw.trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/\s+/g, ' ');

  // 0. Pre-capture and temporarily remove EP info to prevent it from "protecting" noise
  // Handles EP 1, EPISODE 1, EP. 1, E1, E01, SEASON 1, etc.
  // We use a more permissive regex for episode numbers to catch "EP 205" etc.
  const epMatch = title.match(/\b(EP|EPISODE|EP\.|E|SEASON|PART|VOL|VOLUME|V)\s*(\d+)/i);
  const epInfo = epMatch ? epMatch[0] : null;
  
  if (epInfo) {
    // Temporarily replace with a placeholder that won't be caught by noise filters
    title = title.replace(epMatch[0], ' __EP_PLACEHOLDER__ ').replace(/\s{2,}/g, ' ').trim();
  }

  // 1. Prefix noise removal (e.g., "LATEST NIGERIAN MOVIE 2024 - ")
  // Updated to handle multiple descriptors like "HOT TRENDING"
  title = title.replace(/^(LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA)\s+(LATEST|NEW|HOT|TRENDING|TOP|BEST|AWARD WINNING|EPIC|DRAMA|NIGERIAN|NOLLYWOOD|AFRICAN|YORUBA|IGBO)?\s*(MOVIE|FILM|MOVIES|FILMS|NOLLYWOOD|NIGERIAN|AFRICAN)?\s*(\d{4})?\s*[-–—:]\s*/i, '');

  // 2. Specific Nollywood/YouTube noise patterns
  title = title.replace(/\s*\/\s*[A-Z]{2,5}\.?\s*\/?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s*Watch\s+.*/i, '');
  title = title.replace(/\s+[-–—]\s*LATEST\s*.*/i, '');
  title = title.replace(/\s+[-–—]\s*NEW\s*.*/i, '');
  title = title.replace(/\s*#\w+/g, '');
  title = title.replace(/\s+[-–—]\s+(Nigerian|Nollywood|African).*/i, '');
  title = title.replace(/\s+[-–—](Nigerian|Nollywood|African).*/i, '');
  title = title.replace(/\s*Latest\s*(Nigerian|Nollywood|Yoruba|Igbo)?\s*(Epic\s*)?(New\s*)?(Drama\s*)?(Movie|Film|Movies|Films)s?\s*(\d{4})?\s*$/i, '');
  title = title.replace(/\s+[-–—]\s+[A-Z][a-z]+\s+[A-Z][a-z]+\s*[\/,]\s*[A-Z].*$/i, '');
  title = title.replace(/\s*(Full|Complete)\s*(Movie|Film|Season)\s*$/i, '');
  
  // Aggressive pipe/separator stripping for common noise words
  title = title.replace(/\s*[|/]\s*(Moments with Mo|MWM|Full|Complete|Latest|New|Nollywood|Nigerian|African|Epic|Drama|Action|Comedy|Season)\s*(Movie|Film|Movies|Films)?\s*.*$/i, '');
  
  title = title.replace(/\s*\(Latest\s*(Comedy\s*)?(Drama\s*)?(Action\s*)?(Movie|Film|Movies|Films|Full Movie)\s*\)\s*.*$/i, '');


  // 3. Remove pipe-delimited segments and large bracketed text
  title = title.replace(/\|\|[^|]+\|\|/g, '').replace(/\([A-Z][A-Z\s,]{6,}\)/g, '').trim();


  // 4. Heuristic: if title is very long and has a dash, take the first part
  if (title.length > 80) {
    const dashParts = title.split(/\s+[-–—]\s+/);
    if (dashParts[0].length >= 3 && dashParts[0].length <= 70) {
      title = dashParts[0];
    }
  }

  // 5. Final polish before re-injecting EP
  title = title.replace(/\s{2,}/g, ' ').trim();
  title = title.replace(/\s*[,|/\\–—-]+\s*$/, '').trim();
  title = title.replace(/^\s*[,|/\\–—-]+\s*/, '').trim();

  // 6. Re-inject EP info
  if (epInfo) {
    title = title.replace('__EP_PLACEHOLDER__', epInfo);
    // If for some reason the placeholder was lost (unlikely), append it
    if (!title.includes(epInfo)) {
      title = `${title} ${epInfo}`;
    }
  }

  // 7. Title Case conversion (except for short acronyms)
  const minorWords = ['A', 'AN', 'THE', 'AND', 'BUT', 'OR', 'FOR', 'NOR', 'ON', 'AT', 'TO', 'BY', 'OF', 'IN', 'WITH', 'FROM', 'AS'];
  const preservedAcronyms = ['EP', 'EPISODE', 'EP.', 'E', 'SEASON', 'PART', 'VOL', 'VOLUME'];
  
  return title.split(/\s+/).map((w, i) => {
    const upper = w.toUpperCase();
    
    // Check if it's a series marker like EP or SEASON
    if (preservedAcronyms.includes(upper)) return upper;
    
    // Check if it's an episode number (e.g. "1" or "205") following a series marker
    if (/^\d+$/.test(w) && i > 0) {
      const prev = title.split(/\s+/)[i-1].toUpperCase();
      if (preservedAcronyms.includes(prev)) return w;
    }

    if (w.length <= 3 && w === w.toUpperCase() && /^[A-Z]+$/.test(w) && !minorWords.includes(upper)) {
      return w;
    }
    
    if (minorWords.includes(upper) && i !== 0) {
      return w.toLowerCase();
    }
    
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ').replace(/\s{2,}/g, ' ').trim();
}
