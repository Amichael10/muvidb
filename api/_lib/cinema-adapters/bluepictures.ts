/**
 * Blue Pictures adapter — covers Blue Pictures Cinema (Lagos).
 *
 * Blue Pictures runs a WordPress site with a custom "movie-booking" plugin.
 * Showtimes are server-rendered at /now-showing/ with NO dates — only times
 * (e.g. "5:05pm", "3:20pm & 7:20pm"). We treat every scraped time as valid
 * for today (Africa/Lagos). The cron runs daily so the schedule stays fresh.
 *
 * HTML structure (stable as of 2026):
 *   <a href="/movie/[slug]/">
 *     <!-- genre text -->
 *     <div>[showtime text: "5:05pm" or "3:20pm & 7:20pm"]</div>
 *     <h3>[Film Title]</h3>
 *     <img src="[poster]">
 *   </a>
 *   ... (one <a> per film)
 *
 * cinemas.scrape_config must include:
 *   { "nowShowingUrl": "https://bluepicturesng.com/now-showing/" }
 *
 * Optionally override:
 *   { "ticketUrl": "https://bluepicturesng.com/value/blockbuster-ticket/" }
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types';
import { todayLagos } from './types';

const DEFAULT_NOW_SHOWING = 'https://bluepicturesng.com/now-showing/';
const DEFAULT_TICKET_URL  = 'https://bluepicturesng.com/value/blockbuster-ticket/';

// Matches "5:05pm", "3:20pm", "10:30am", "12:00pm"
const TIME_PATTERN = /\b(\d{1,2}:\d{2})\s*(am|pm)\b/gi;

/**
 * Parse a time string like "5:05pm" → "17:05:00"
 */
function parseTime12h(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return null;
  let hr = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === 'am') {
    if (hr === 12) hr = 0;
  } else {
    if (hr !== 12) hr += 12;
  }
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

/**
 * Extract all times from a string like "3:20pm & 7:20pm" → ["15:20:00","19:20:00"]
 */
function extractTimes(text: string): string[] {
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  TIME_PATTERN.lastIndex = 0;
  while ((m = TIME_PATTERN.exec(text)) !== null) {
    const parsed = parseTime12h(m[0]);
    if (parsed) matches.push(parsed);
  }
  return matches;
}

/**
 * Strip HTML tags and decode basic HTML entities.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parse the /now-showing/ HTML.
 * Returns a flat list of { filmTitle, posterUrl, showTimes[] }.
 */
interface ParsedFilm {
  title: string;
  slug: string;
  posterUrl: string | null;
  times: string[];       // HH:MM:SS 24h
}

function parseNowShowingHtml(html: string): ParsedFilm[] {
  const films: ParsedFilm[] = [];

  // Each film is inside <a href="/movie/[slug]/">...</a>
  // We split by this pattern to get per-film blocks
  const cardRe = /<a\s+href="([^"]*\/movie\/([^"\/]+)\/?)"[^>]*>([\s\S]*?)<\/a>/gi;
  let cardMatch: RegExpExecArray | null;

  while ((cardMatch = cardRe.exec(html)) !== null) {
    const _href = cardMatch[1];
    const slug  = cardMatch[2];
    const body  = cardMatch[3];

    // Title from <h3>...</h3>
    const titleMatch = body.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    if (!titleMatch) continue;
    const title = stripHtml(titleMatch[1]);
    if (!title) continue;

    // Poster from first <img src="...">
    let posterUrl: string | null = null;
    const imgMatch = body.match(/<img[^>]+src="([^"]+)"/i);
    if (imgMatch) posterUrl = imgMatch[1];

    // Extract all time strings from the entire card body (text nodes)
    const plainText = stripHtml(body);
    const times = extractTimes(plainText);

    films.push({ title, slug, posterUrl, times });
  }

  return films;
}

export const bluepicturesAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const nowShowingUrl: string = cfg.nowShowingUrl || DEFAULT_NOW_SHOWING;
  const ticketUrl: string     = cfg.ticketUrl     || DEFAULT_TICKET_URL;

  let html: string;
  try {
    const res = await fetch(nowShowingUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!res.ok) {
      return {
        cinemaId: cinema.id,
        showtimes: [],
        error: `Blue Pictures HTTP ${res.status} fetching ${nowShowingUrl}`,
      };
    }

    html = await res.text();
  } catch (err: any) {
    return { cinemaId: cinema.id, showtimes: [], error: err.message };
  }

  if (!html.includes('/movie/')) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'Blue Pictures: /now-showing/ did not contain expected film markup — site structure may have changed.',
    };
  }

  const films = parseNowShowingHtml(html);
  const today = todayLagos(0);
  const showtimes: ScrapedShowtime[] = [];

  for (const film of films) {
    if (!film.times.length) {
      // Film listed but no parseable times — include with a default time of 00:00:00
      // so it still passes through the Nollywood matcher (no DB write without a valid time)
      continue;
    }
    for (const showTime of film.times) {
      showtimes.push({
        externalFilmId: `bp-${film.slug}`,
        filmTitle: film.title,
        filmMeta: {
          posterUrl: film.posterUrl,
        },
        showDate: today,
        showTime,
        format: 'Standard',  // Blue Pictures is a single-screen standard cinema
        ticketUrl,
      });
    }
  }

  const warnings: string[] = [];
  if (films.length === 0) {
    warnings.push('No film cards found on /now-showing/ — site may be down or structure changed.');
  } else {
    const noTimes = films.filter(f => f.times.length === 0);
    if (noTimes.length > 0) {
      warnings.push(`${noTimes.length} film(s) had no parseable showtimes: ${noTimes.map(f => f.title).join(', ')}`);
    }
  }

  return {
    cinemaId: cinema.id,
    showtimes,
    warnings: warnings.length ? warnings : undefined,
  };
};
