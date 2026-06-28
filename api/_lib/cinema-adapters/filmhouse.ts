/**
 * Filmhouse Cinemas adapter — deterministic, no AI, no paid service.
 *
 * filmhouseng.com is a Next.js app that SERVER-RENDERS the schedule (film titles
 * + showtimes) into the page — both the visible DOM and the <script id="__NEXT_DATA__">
 * JSON blob. Only the *booking* deep-link carries an AES blob; the schedule itself
 * is plain text. So we fetch the page, read __NEXT_DATA__, and pull titles + times.
 *
 * ⚠️ GEO: filmhouseng.com 307-redirects non-Nigerian IPs. This adapter only
 *    succeeds when the scrape runs from a Nigerian IP (local machine / NG VPS),
 *    NOT from Vercel's default US region.
 *
 * scrape_config: { "url": "https://www.filmhouseng.com/en/cinemas/lekki/movies",
 *                  "cinemaSlug": "lekki" }   // cinemaSlug optional, used to filter
 */
import * as cheerio from 'cheerio';
import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { todayLagos } from './types.js';

// "10:00AM" / "10:00 AM" / "22:05" / ISO → HH:MM:SS (+ date if ISO)
function parseTime(raw: any): { time: string; date?: string } | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    const l = new Date(d.getTime() + 60 * 60 * 1000); // Lagos UTC+1
    return { date: l.toISOString().slice(0, 10), time: l.toISOString().slice(11, 19) };
  }
  const m = s.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return { time: `${String(h).padStart(2, '0')}:${m[2]}:00` };
}

// Recursively find { film title, [times] } structures regardless of exact key names.
function extractFromJson(root: any, fallbackDate: string): ScrapedShowtime[] {
  const out: ScrapedShowtime[] = [];
  const seen = new Set<string>();
  const TITLE_KEYS = ['title', 'name', 'filmTitle', 'movieTitle', 'filmName'];
  const SESSION_KEYS = ['sessions', 'showtimes', 'performances', 'times', 'screenings', 'schedules', 'showTimes'];

  const titleOf = (o: any): string | null => {
    for (const k of TITLE_KEYS) if (typeof o?.[k] === 'string' && o[k].trim()) return o[k].trim();
    if (typeof o?.film?.title === 'string') return o.film.title.trim();
    if (typeof o?.movie?.title === 'string') return o.movie.title.trim();
    return null;
  };
  const sessionsOf = (o: any): any[] | null => {
    for (const k of SESSION_KEYS) if (Array.isArray(o?.[k])) return o[k];
    return null;
  };

  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const title = titleOf(node);
    const sessions = sessionsOf(node);
    if (title && sessions) {
      for (const s of sessions) {
        const rawTime = typeof s === 'string' ? s : (s?.time ?? s?.startTime ?? s?.showTime ?? s?.start ?? s?.startsAt);
        const parsed = parseTime(rawTime);
        if (!parsed) continue;
        const date = parsed.date ?? parseTime(s?.date)?.date ?? (typeof s?.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s.date) ? s.date.slice(0, 10) : fallbackDate);
        const key = `${title}|${date}|${parsed.time}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          externalFilmId: title.toLowerCase().replace(/\s+/g, '-'),
          filmTitle: title,
          showDate: date,
          showTime: parsed.time,
          format: 'Standard',
          screenName: typeof s?.screen === 'string' ? s.screen : null,
          ticketUrl: typeof s?.url === 'string' ? s.url : (typeof s?.bookingUrl === 'string' ? s.bookingUrl : null),
        });
      }
    }
    for (const k of Object.keys(node)) visit(node[k]);
  };
  visit(root);
  return out;
}

export const filmhouseAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const url: string | undefined = cinema.scrape_config?.url;
  if (!url) return { cinemaId: cinema.id, showtimes: [], error: 'filmhouse adapter: scrape_config.url is required' };

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-NG,en;q=0.9',
      },
    });
    if (!res.ok) {
      const note = res.status === 307 || res.status === 403 ? ' (geo-blocked? run from a Nigerian IP)' : '';
      return { cinemaId: cinema.id, showtimes: [], error: `Filmhouse ${res.status} @ ${url}${note}` };
    }
    html = await res.text();
  } catch (e: any) {
    return { cinemaId: cinema.id, showtimes: [], error: `Filmhouse fetch failed: ${e.message}` };
  }

  const fallbackDate = todayLagos(0);
  const $ = cheerio.load(html);
  const nextDataRaw = $('#__NEXT_DATA__').first().contents().text();

  let showtimes: ScrapedShowtime[] = [];
  if (nextDataRaw) {
    try {
      showtimes = extractFromJson(JSON.parse(nextDataRaw), fallbackDate);
    } catch { /* fall through to DOM */ }
  }

  const warnings: string[] = [];
  if (showtimes.length === 0) {
    warnings.push('No showtimes parsed from __NEXT_DATA__ — the JSON field names may differ. Run scripts/test_filmhouse.mjs and share the structure dump.');
  }

  return { cinemaId: cinema.id, showtimes, warnings };
};
