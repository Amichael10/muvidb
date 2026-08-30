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

import * as cheerio from 'cheerio';
import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { todayLagos } from './types.js';
import { cinemaFetch } from './cinema-fetch.js';

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
    if (parsed && !matches.includes(parsed)) matches.push(parsed);
  }
  return matches;
}

/**
 * Parse the /now-showing/ HTML.
 * Returns a flat list of { filmTitle, posterUrl, showTimes[], ticketUrl }.
 */
interface ParsedFilm {
  title: string;
  slug: string;
  posterUrl: string | null;
  times: string[];       // HH:MM:SS 24h
  ticketUrl?: string | null;
}

function parseNowShowingHtml(html: string): ParsedFilm[] {
  const $ = cheerio.load(html);
  const films: ParsedFilm[] = [];

  $('.mb-movie-item').each((_, el) => {
    const item = $(el);
    const titleEl = item.find('.movie-title, h3');
    const title = titleEl.text().trim();
    if (!title) return;

    const movieLink = item.find('a[href*="/movie/"]').first().attr('href') || '';
    const slugMatch = movieLink.match(/\/movie\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const posterUrl = item.find('.movie-image img, img').first().attr('src') || null;

    const timeText = item.find('.running-time').text().trim() || item.text();
    const times = extractTimes(timeText);

    const ticketUrl = item.find('a[href*="/value/"], a.btn-custom-link').attr('href') || null;

    films.push({ title, slug, posterUrl, times, ticketUrl });
  });

  // Fallback if class names changed
  if (films.length === 0) {
    $('div:has(h3):has(img)').each((_, el) => {
      const item = $(el);
      const title = item.find('h3').first().text().trim();
      if (!title) return;
      const movieLink = item.find('a[href*="/movie/"]').first().attr('href') || '';
      const slugMatch = movieLink.match(/\/movie\/([^/]+)/);
      const slug = slugMatch ? slugMatch[1] : title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const posterUrl = item.find('img').first().attr('src') || null;
      const times = extractTimes(item.text());
      if (times.length > 0) {
        films.push({ title, slug, posterUrl, times });
      }
    });
  }

  return films;
}

export const bluepicturesAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const nowShowingUrl: string = cfg.nowShowingUrl || cfg.url || DEFAULT_NOW_SHOWING;
  const ticketUrl: string     = cfg.ticketUrl     || DEFAULT_TICKET_URL;

  let html: string;
  try {
    const res = await cinemaFetch(nowShowingUrl, {
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
        format: 'Standard',
        ticketUrl: film.ticketUrl || ticketUrl,
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
