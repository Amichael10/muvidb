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
 *
 * HTML structure (stable as of 2025):
 *   <div class="film" id="ST00001764">
 *     <h3 class="title">Film Title</h3>
 *     <span class="censor">PG</span>
 *     <img class="poster" src="/Media/Poster?siteToken=...&code=...">
 *     <div class="sessions">
 *       <div class="date-container">
 *         <h4 class="date">Sunday 19, April</h4>
 *         <ul class="session-times">
 *           <li>
 *             <a href="/purchase/286926?siteToken=...">
 *               <time>6:50 PM</time>
 *               <span class="screen-attribute attribute-...">GR</span>
 *             </a>
 *           </li>
 *         </ul>
 *       </div>
 *     </div>
 *   </div>
 *
 * Date format: "Sunday 19, April" — no year; we infer the year by checking whether
 * the date is in the past relative to today (Lagos), and rolling over to next year
 * if we're in late December looking at January dates.
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types';
import { inferFormat } from './types';

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
  if (ampm === 'AM') {
    if (hr === 12) hr = 0;
  } else {
    if (hr !== 12) hr += 12;
  }
  return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

/**
 * Extract text content from a simple HTML tag — ignores nested tags.
 * e.g. `<h3 class="title">  My Film  </h3>` → "My Film"
 */
function extractTag(html: string, tag: string, className?: string): string | null {
  const classClause = className ? `[^>]*class="[^"]*${className}[^"]*"` : '';
  const re = new RegExp(`<${tag}${classClause}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = html.match(re);
  if (!m) return null;
  // Strip inner tags, decode basic entities, trim
  return m[1]
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim() || null;
}

/**
 * Parse the Veezi widget HTML and return ScrapedShowtime[].
 * siteToken is passed in so we can build absolute poster + ticket URLs.
 */
function parseVeeziHtml(html: string, siteToken: string): ScrapedShowtime[] {
  const showtimes: ScrapedShowtime[] = [];

  // Split into per-film blocks — each starts with <div class="film" id="ST...">
  // We use the id= to split; the closing </div> boundary is approximated by the
  // next film id or end-of-string.
  const filmBlocks = html.split(/<div[^>]+class="[^"]*\bfilm\b[^"]*"[^>]+id="(ST\d+)"/i);

  // filmBlocks[0] = preamble (skip)
  // filmBlocks[1] = film id, filmBlocks[2] = content, filmBlocks[3] = film id, ...
  for (let i = 1; i < filmBlocks.length - 1; i += 2) {
    const filmId = filmBlocks[i];       // e.g. "ST00001764"
    const block  = filmBlocks[i + 1];  // everything until the next split

    const title = extractTag(block, 'h3', 'title');
    if (!title) continue;

    const rating = extractTag(block, 'span', 'censor');

    // Poster: <img class="poster" src="/Media/Poster?siteToken=...&code=...">
    const posterMatch = block.match(/<img[^>]+class="[^"]*poster[^"]*"[^>]+src="([^"]+)"/i)
                     || block.match(/<img[^>]+src="([^"]+)"[^>]+class="[^"]*poster[^"]*"/i);
    let posterUrl: string | null = null;
    if (posterMatch) {
      const src = posterMatch[1];
      posterUrl = src.startsWith('http') ? src : `${VEEZI_BASE}${src}`;
    }

    // Split into date-container blocks
    const dateBlocks = block.split(/<div[^>]+class="[^"]*date-container[^"]*"[^>]*>/i);
    // dateBlocks[0] = pre-dates section (skip)
    for (let j = 1; j < dateBlocks.length; j++) {
      const dateBlock = dateBlocks[j];

      const dateText = extractTag(dateBlock, 'h4', 'date');
      if (!dateText) continue;
      const showDate = parseVeeziDate(dateText);
      if (!showDate) continue;

      // Extract all session <a> tags within session-times
      // Pattern: <a href="/purchase/286926?siteToken=...">...<time>6:50 PM</time>...<span class="screen-attribute...">GR</span>
      const sessionRe = /<a\s+href="\/purchase\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      let sessionMatch: RegExpExecArray | null;

      while ((sessionMatch = sessionRe.exec(dateBlock)) !== null) {
        const sessionId = sessionMatch[1];
        const sessionContent = sessionMatch[2];

        const timeText = extractTag(sessionContent, 'time');
        if (!timeText) continue;
        const showTime = parseVeeziTime(timeText);
        if (!showTime) continue;

        // Screen attribute — text inside span.screen-attribute
        const attrMatch = sessionContent.match(
          /<span[^>]+class="[^"]*screen-attribute[^"]*"[^>]*>([^<]+)<\/span>/i
        );
        const attrLabel = attrMatch ? attrMatch[1].trim().toUpperCase() : 'GR';
        const format = SCREEN_ATTR_FORMAT[attrLabel] ?? inferFormat(attrLabel);

        const ticketUrl = `${VEEZI_PURCHASE_BASE}/${sessionId}?siteToken=${siteToken}`;

        showtimes.push({
          externalFilmId: filmId,
          filmTitle: title,
          filmMeta: {
            posterUrl,
            rating: rating ?? null,
          },
          showDate,
          showTime,
          format,
          ticketUrl,
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
    const res = await fetch(url, {
      headers: {
        // Must send a browser-like UA; Veezi returns 403 for curl/bot UAs
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

  return {
    cinemaId: cinema.id,
    showtimes,
    warnings:
      showtimes.length === 0
        ? [`Parsed 0 showtimes from Veezi widget — may be no upcoming sessions or HTML structure changed.`]
        : undefined,
  };
};
