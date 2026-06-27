/**
 * Genesis Cinemas adapter — deterministic, no AI, no paid Firecrawl.
 *
 * Genesis runs on the "Jacro" WordPress cinema plugin. Each location page
 * (scrape_config.url, e.g. https://genesiscinemas.com/genesis-center-port-harcourt/)
 * server-renders the CURRENTLY-SELECTED day's lineup directly in the HTML:
 *
 *   <input id="film_date" value="2026-06-27">              ← the rendered date
 *   <div class="singlefilmperfs ...">
 *     <a class="perfbtn" href=".../booknow/168534">20:05  VIP</a>
 *     <input class="conf_screen_film" value="CALL OF MY LIFE(VIP)">
 *     <input class="conf_screen_time" value="20:05">
 *     <input class="conf_screen_location" value="Port Harcourt">
 *   </div>
 *
 * We parse those nodes with cheerio. The page only renders the server's "today";
 * other days load via a JS ajax chain (get_dates_from_cinema → get_films_from_date)
 * that needs an internal numeric cinemaid not exposed in the HTML. Pulling the full
 * forward week is a future enhancement — for now we capture today's full schedule
 * each run, which keeps "In Cinemas Now" + today's showtimes accurate.
 */
import * as cheerio from 'cheerio';
import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { todayLagos } from './types.js';

const FORMAT_SUFFIX = /\s*\((VIP|3D|2D|IMAX|4DX|STANDARD|PREMIUM|RECLINER)\)\s*$/i;

function cleanTitle(raw: string): { title: string; format: string } {
  const m = raw.match(FORMAT_SUFFIX);
  const format = m ? normFormat(m[1]) : 'Standard';
  const title = raw.replace(FORMAT_SUFFIX, '').trim();
  return { title, format };
}
function normFormat(s: string): string {
  const u = s.toUpperCase();
  if (u.includes('IMAX')) return 'IMAX';
  if (u.includes('4DX')) return '4DX';
  if (u.includes('3D')) return '3D';
  if (u.includes('RECLINER')) return 'Recliner';
  if (u.includes('VIP') || u.includes('PREMIUM') || u.includes('LUXE')) return 'VIP';
  return 'Standard';
}

export const genesisAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const url: string | undefined = cinema.scrape_config?.url;
  if (!url) {
    return { cinemaId: cinema.id, showtimes: [], error: 'genesis adapter: scrape_config.url is required' };
  }

  let html: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': new URL(url).origin + '/',
      },
    });
    if (!res.ok) return { cinemaId: cinema.id, showtimes: [], error: `Genesis ${res.status} @ ${url}` };
    html = await res.text();
  } catch (e: any) {
    return { cinemaId: cinema.id, showtimes: [], error: `Genesis fetch failed: ${e.message}` };
  }

  const $ = cheerio.load(html);
  const showDate = ($('#film_date').attr('value') || '').trim() || todayLagos(0);

  const showtimes: ScrapedShowtime[] = [];
  $('.singlefilmperfs').each((_i, el) => {
    const node = $(el);
    const rawFilm = (node.find('.conf_screen_film').attr('value') || '').trim();
    const time = (node.find('.conf_screen_time').attr('value') || '').trim(); // "HH:MM"
    if (!rawFilm || !/^\d{1,2}:\d{2}$/.test(time)) return;

    const { title, format } = cleanTitle(rawFilm);
    const btnText = node.find('.perfbtn').first().text().trim(); // "20:05  VIP"
    const fmt = format !== 'Standard' ? format : normFormat(btnText.replace(/^\s*\d{1,2}:\d{2}/, '').trim() || 'Standard');
    const ticketUrl = node.find('.perfbtn').first().attr('href') || null;
    const screen = (node.find('.conf_screen_location').attr('value') || '').trim() || null;

    showtimes.push({
      externalFilmId: title.toLowerCase().replace(/\s+/g, '-'),
      filmTitle: title,
      showDate,
      showTime: `${time.padStart(5, '0')}:00`,
      format: fmt,
      screenName: screen,
      ticketUrl,
    });
  });

  const warnings: string[] = [];
  if (showtimes.length === 0) warnings.push('No showtimes parsed — page layout may have changed or no screenings today.');

  return { cinemaId: cinema.id, showtimes, warnings };
};
