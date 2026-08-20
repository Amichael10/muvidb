/**
 * Veezi adapter — covers all Silverbird cinema locations in Nigeria.
 *
 * Veezi is a New Zealand-based cinema management SaaS. Each Silverbird site has
 * a public "siteToken" that gates its ticketing widget. We fetch the widget HTML
 * and parse the schedule entirely client-side (no paid API needed).
 *
 * Widget URL: https://ticketing.eu.veezi.com/sessions/?siteToken=<TOKEN>
 * Returns a full multi-day schedule in a single HTML document.
 *
 * cinemas.scrape_config must include:
 *   { "siteToken": "4x3z2wcre0rek2beab5w344ae0" }
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { inferFormat } from './types.js';
import { cinemaFetch } from './cinema-fetch.js';

const VEEZI_BASE = 'https://ticketing.eu.veezi.com';
const VEEZI_PURCHASE_BASE = 'https://ticketing.eu.veezi.com/purchase';

// Month names → 0-indexed month number
const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// Veezi screen-attribute text → showtime format
const SCREEN_ATTR_FORMAT: Record<string, string> = {
  'GR':   'Standard',  // General Release
  '2D':   'Standard',
  '3D':   '3D',
  'IMAX': 'IMAX',
  '4DX':  '4DX',
  'VIP':  'VIP',
  'PLF':  'IMAX',      // Premium Large Format → treat as IMAX
  'D-BOX': '4DX',
};

/**
 * Parse Veezi date string "Sunday 19, April" → "YYYY-MM-DD" in Lagos time.
 * Year is inferred: pick the nearest future occurrence (or today).
 * Handles December→January rollover.
 */
function parseVeeziDate(dateStr: string): string | null {
  // "Sunday 19, April" or "Monday 20, April"
  const m = dateStr.match(/(\d{1,2}),\s+([A-Za-z]+)/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monthIdx = MONTH_MAP[m[2].toLowerCase()];
  if (monthIdx === undefined || isNaN(day)) return null;

  // Today in Lagos (UTC+1, no DST)
  const nowLagos = new Date(Date.now() + 60 * 60 * 1000);
  const todayYear = nowLagos.getUTCFullYear();
  const todayMonth = nowLagos.getUTCMonth();
  const todayDay = nowLagos.getUTCDate();

  // Try this year first; if date is already past, use next year
  let year = todayYear;
  const candidate = new Date(Date.UTC(year, monthIdx, day));
  const todayMidnight = new Date(Date.UTC(todayYear, todayMonth, todayDay));
  if (candidate < todayMidnight) {
    // The date has already passed this year → use next year
    year = todayYear + 1;
  }

  const yyyy = String(year);
  const mm = String(monthIdx + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Parse "6:50 PM" or "10:30 AM" → "HH:MM:SS" 24-hour.
 */
function parseVeeziTime(timeStr: string): string | null {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let hr = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && hr < 12) hr += 12;
  if (ampm === 'AM' && hr === 12) hr = 0;
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

/**
 * Strip HTML tags from a string.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Extract clean text content from inside a tag match.
 */
function extractTagContent(html: string, tagName: string): string | null {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const m = html.match(re);
  return m ? stripTags(m[1]) : null;
}

/**
 * Parse the full Veezi widget HTML into ScrapedShowtime rows.
 * Uses regex matching rather than cheerio so we have no external DOM dependency.
 *
 * siteToken is passed in so we can build absolute poster + ticket URLs.
 */
function parseVeeziHtml(html: string, siteToken: string): ScrapedShowtime[] {
  const showtimes: ScrapedShowtime[] = [];

  // Split into per-film blocks: <div class="film" ...> ... </div> (until next film or end)
  // Each film block contains: title, censor rating, poster img, and multiple date-containers
  const filmBlocks = html.split(/<div\s+class=["']film["']/i).slice(1);

  for (const block of filmBlocks) {
    // Film title: <h3 class="title">Film Title</h3>
    const titleMatch = block.match(/<h3\s+class=["']title["'][^>]*>([\s\S]*?)<\/h3>/i);
    if (!titleMatch) continue;
    const rawTitle = stripTags(titleMatch[1]);
    if (!rawTitle) continue;

    // Format from title if present, e.g. "Spider-Man (3D)"
    const titleFormat = inferFormat(rawTitle);

    // Censor/rating: <span class="censor">PG</span>
    const ratingMatch = block.match(/<span\s+class=["']censor["'][^>]*>([\s\S]*?)<\/span>/i);
    const rating = ratingMatch ? stripTags(ratingMatch[1]) : undefined;

    // Poster: <img class="poster" src="/Media/Poster?siteToken=...&code=...">
    let posterUrl: string | undefined;
    const posterMatch = block.match(/<img[^>]+class=["']poster["'][^>]+src=["']([^"']+)["']/i)
      || block.match(/<img[^>]+src=["']([^"']+)["'][^>]+class=["']poster["']/i);
    if (posterMatch) {
      const src = posterMatch[1].replace(/&amp;/g, '&');
      posterUrl = src.startsWith('http') ? src : `${VEEZI_BASE}${src.startsWith('/') ? '' : '/'}${src}`;
    }

    // Split film block into date-containers: <div class="date-container"> ...
    const dateContainers = block.split(/<div\s+class=["']date-container["']/i).slice(1);

    for (const dateBlock of dateContainers) {
      // Date: <h4 class="date">Sunday 19, April</h4>
      const dateMatch = dateBlock.match(/<h4\s+class=["']date["'][^>]*>([\s\S]*?)<\/h4>/i);
      if (!dateMatch) continue;
      const rawDate = stripTags(dateMatch[1]);
      const showDate = parseVeeziDate(rawDate);
      if (!showDate) continue;

      // Extract all session <li> items inside this date container
      // Pattern: <a href="/purchase/286926?siteToken=...">...<time>6:50 PM</time>...<span class="screen-attribute...">GR</span>
      const liMatches = dateBlock.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi);

      for (const liMatch of liMatches) {
        const li = liMatch[1];

        // Showtime: <time>6:50 PM</time>
        const timeMatch = li.match(/<time[^>]*>([\s\S]*?)<\/time>/i);
        if (!timeMatch) continue;
        const showTime = parseVeeziTime(stripTags(timeMatch[1]));
        if (!showTime) continue;

        // Screen attribute: <span class="screen-attribute attribute-...">GR</span>
        const attrMatch = li.match(/<span\s+class=["'][^"']*screen-attribute[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
        const attrCode = attrMatch ? stripTags(attrMatch[1]).toUpperCase() : '';
        const format = SCREEN_ATTR_FORMAT[attrCode] || titleFormat || 'Standard';

        // Ticket URL / session ID: href="/purchase/286926?siteToken=..." or href="https://..."
        let ticketUrl: string | undefined;
        const hrefMatch = li.match(/href=["']([^"']+)["']/i);
        if (hrefMatch) {
          const href = hrefMatch[1].replace(/&amp;/g, '&');
          if (href.startsWith('http')) {
            ticketUrl = href;
          } else {
            // Relative path like "/purchase/286926?siteToken=..."
            ticketUrl = `${VEEZI_BASE}${href.startsWith('/') ? '' : '/'}${href}`;
          }
        }

        showtimes.push({
          externalFilmId: `veezi-${siteToken}-${rawTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          filmTitle: rawTitle,
          showDate,
          showTime,
          format,
          ticketUrl,
          filmMeta: {
            rating: rating || undefined,
            posterUrl,
          },
        });
      }
    }
  }

  return showtimes;
}

export const veeziAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const siteToken: string | undefined = cfg.siteToken;
  if (!siteToken) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'scrape_config.siteToken is required for veezi adapter',
    };
  }

  const url = `${VEEZI_BASE}/sessions/?siteToken=${siteToken}`;

  let html: string;
  try {
    const res = await cinemaFetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        Referer: `${VEEZI_BASE}/`,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        cinemaId: cinema.id,
        showtimes: [],
        error: `Veezi HTTP ${res.status} for siteToken=${siteToken} :: ${body.slice(0, 200)}`,
      };
    }

    html = await res.text();
  } catch (err: any) {
    return { cinemaId: cinema.id, showtimes: [], error: err.message };
  }

  // Quick sanity check — the widget HTML always contains this class
  if (!html.includes('session-times') && !html.includes('class="film"')) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: `Veezi response did not contain expected schedule HTML (siteToken=${siteToken}). Site structure may have changed.`,
    };
  }

  const showtimes = parseVeeziHtml(html, siteToken);

  const warnings: string[] = [];
  if (showtimes.length === 0) {
    warnings.push(`Veezi returned schedule HTML for siteToken=${siteToken} but 0 showtimes were parsed.`);
  }

  return {
    cinemaId: cinema.id,
    showtimes,
    warnings: warnings.length ? warnings : undefined,
  };
};
