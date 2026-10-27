/**
 * Cinesync adapter — covers Filmhouse Cinemas (and any chain on the Cinesync
 * platform by EAD Systems).
 *
 * Filmhouse proxies booking calls through https://www.filmhouseng.com/api/external
 * with AES-256-CBC encrypted payloads using key 'ascvdWD34_GKIbnDVBONKE23GZLpMgA34567890'.
 */

import crypto from 'crypto';
import https from 'https';
import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { inferFormat } from './types.js';

const ENCRYPTION_KEY = 'ascvdWD34_GKIbnDVBONKE23GZLpMgA34567890';
const FILMHOUSE_STATIC_URL = 'https://filmhouseng.static.cinesync.io';

const LOCATION_MAPPINGS = [
  { id: '6', slug: 'lekki', pattern: 'imax lekki' },
  { id: '5', slug: 'landmark', pattern: 'landmark' },
  { id: '7', slug: 'surulere', pattern: 'surulere' },
  { id: '8', slug: 'circlemall', pattern: 'circle mall' },
  { id: '14', slug: 'akure', pattern: 'akure' },
  { id: '13', slug: 'samonda', pattern: 'samonda' },
  { id: '19', slug: 'ilorin', pattern: 'ilorin' },
  { id: '10', slug: 'oniru', pattern: 'oniru' },
  { id: '11', slug: 'palmslekki', pattern: 'palms lekki' },
  { id: '12', slug: 'benin', pattern: 'benin' },
  { id: '4', slug: 'dugbe', pattern: 'dugbe' },
];

function encryptCryptoJS(plainText: string, passphrase: string): string {
  const salt = crypto.randomBytes(8);
  let md5 = crypto.createHash('md5');
  md5.update(Buffer.concat([Buffer.from(passphrase, 'utf8'), salt]));
  let currentHash = md5.digest();
  const md5s = [currentHash];

  while (Buffer.concat(md5s).length < 48) {
    md5 = crypto.createHash('md5');
    md5.update(Buffer.concat([currentHash, Buffer.from(passphrase, 'utf8'), salt]));
    currentHash = md5.digest();
    md5s.push(currentHash);
  }

  const keyMaterial = Buffer.concat(md5s);
  const cipher = crypto.createCipheriv('aes-256-cbc', keyMaterial.subarray(0, 32), keyMaterial.subarray(32, 48));
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__', 'utf8'), salt, encrypted]).toString('base64');
}

function apiRequest(requestData: unknown): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      payload: encryptCryptoJS(JSON.stringify(requestData), ENCRYPTION_KEY),
    });

    const request = https.request('https://www.filmhouseng.com/api/external', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      },
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error(`Filmhouse returned invalid JSON (${response.statusCode ?? 'unknown status'})`));
        }
      });
    });

    request.setTimeout(30_000, () => request.destroy(new Error('Filmhouse API request timed out after 30 seconds')));
    request.on('error', reject);
    request.write(postData);
    request.end();
  });
}

function convertTimeTo24h(value: string): string | null {
  const match = value?.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (match[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${match[2]}:00`;
}

function absoluteImageUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${FILMHOUSE_STATIC_URL}/${value.replace(/^\/+/, '')}`;
}

function numberFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : null;
}

function runtimeMinutes(value: unknown): number | null {
  if (typeof value === 'number') return value >= 20 && value <= 600 ? value : null;
  if (typeof value !== 'string') return null;

  const hours = value.match(/(\d+)\s*h/i);
  const minutes = value.match(/(\d+)\s*m/i);
  if (hours || minutes) {
    const total = Number(hours?.[1] || 0) * 60 + Number(minutes?.[1] || 0);
    return total >= 20 && total <= 600 ? total : null;
  }

  const numeric = Number(value.trim());
  return Number.isFinite(numeric) && numeric >= 20 && numeric <= 600 ? numeric : null;
}

function filmMeta(movie: any): ScrapedShowtime['filmMeta'] {
  const genreValue = movie.genres ?? movie.genre;
  const genres = Array.isArray(genreValue)
    ? genreValue.map((genre: any) => typeof genre === 'string' ? genre : genre?.name).filter(Boolean)
    : typeof genreValue === 'string'
      ? genreValue.split(',').map((genre: string) => genre.trim()).filter(Boolean)
      : undefined;

  return {
    posterUrl: absoluteImageUrl(movie.poster_url ?? movie.poster ?? movie.image ?? movie.movie_image),
    backdropUrl: absoluteImageUrl(movie.backdrop_url ?? movie.banner ?? movie.cover_image),
    synopsis: movie.synopsis ?? movie.description ?? movie.short_description ?? null,
    runtimeMinutes: runtimeMinutes(movie.runtime ?? movie.duration),
    rating: movie.rating ?? movie.certificate ?? movie.age_rating ?? null,
    releaseYear: numberFrom(movie.release_year ?? movie.year),
    genres,
  };
}

export const cinesyncAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const nameLower = (cinema.name || '').toLowerCase();
  let locationId = cinema.scrape_config?.locationId || cinema.scrape_config?.cinemaLocationId;

  if (!locationId) {
    const match = LOCATION_MAPPINGS.find(m => nameLower.includes(m.pattern) || nameLower.includes(m.slug));
    if (match) {
      locationId = match.id;
    }
  }

  if (!locationId) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: `cinesync adapter: cannot resolve locationId for cinema '${cinema.name}'`,
    };
  }

  try {
    // 1. Fetch active dates
    const datesRes = await apiRequest({
      endpoint: 'cms_widget/index',
      method: 'POST',
      data: {
        api: 'dates',
        sales_channel_id: 1,
        cinema_location_id: String(locationId),
        page_number: '1',
        url_key: '',
        group_to_theater_experiance: false,
      },
      headers: {},
      langId: '1',
    });

    const dates: string[] = (datesRes?.data?.dates || []).map((d: any) => d.date).filter(Boolean).slice(0, 7);
    if (!dates.length) {
      return { cinemaId: cinema.id, showtimes: [] };
    }

    // 2. Fetch showtimes for each date
    const showtimes: ScrapedShowtime[] = [];

    for (const date of dates) {
      const result = await apiRequest({
        endpoint: 'cms_widget/index',
        method: 'POST',
        data: {
          api: 'schedule',
          date,
          cinema_location_id: String(locationId),
          sales_channel_id: 1,
          page_number: 1,
          url_key: '',
          theater_experiance: '',
          group_to_theater_experiance: false,
          sort_by: '',
        },
        headers: {},
        langId: '1',
      });

      for (const movie of result?.data?.movies || []) {
        const title = (movie.movie_name || movie.title || '').trim();
        if (!title) continue;
        const metadata = filmMeta(movie);

        for (const slot of movie.show_times || movie.showtimes || []) {
          const showTime = convertTimeTo24h(slot.show_time_slots || slot.show_time || '');
          if (!showTime) continue;
          const screenName = slot.screen_name ?? slot.screen ?? slot.theater_experiance_name ?? null;

          showtimes.push({
            externalFilmId: String(movie.movie_id ?? movie.id ?? movie.uuid ?? title),
            filmTitle: title,
            filmMeta: metadata,
            showDate: date,
            showTime,
            format: inferFormat(screenName),
            screenName,
            ticketUrl: slot.show_time_uuid
              ? `https://www.filmhouseng.com/buy-tickets?showtime=${slot.show_time_uuid}`
              : 'https://www.filmhouseng.com/buy-tickets',
            price: numberFrom(slot.price ?? slot.price_from),
          });
        }
      }
    }

    return { cinemaId: cinema.id, showtimes };
  } catch (err: any) {
    return { cinemaId: cinema.id, showtimes: [], error: err.message };
  }
};
