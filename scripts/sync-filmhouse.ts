import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import { cleanCinemaListingTitle, sweepStaleCinemas, upsertShowtimes } from '../api/_lib/cinema-adapters/index.js';
import { inferFormat, type ScrapedShowtime } from '../api/_lib/cinema-adapters/types.js';

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };
Object.assign(process.env, env);

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const ENCRYPTION_KEY = 'ascvdWD34_GKIbnDVBONKE23GZLpMgA34567890';
const FILMHOUSE_STATIC_URL = 'https://filmhouseng.static.cinesync.io';

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

    request.setTimeout(45_000, () => request.destroy(new Error('Filmhouse API request timed out after 45 seconds')));
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

const LOCATION_MAPPINGS = [
  { id: '6', slug: 'lekki', dbNamePattern: 'imax lekki' },
  { id: '5', slug: 'landmark', dbNamePattern: 'landmark' },
  { id: '7', slug: 'surulere', dbNamePattern: 'surulere' },
  { id: '8', slug: 'circlemall', dbNamePattern: 'circle mall' },
  { id: '14', slug: 'akure', dbNamePattern: 'akure' },
  { id: '13', slug: 'samonda', dbNamePattern: 'samonda' },
  { id: '19', slug: 'ilorin', dbNamePattern: 'ilorin' },
  { id: '10', slug: 'oniru', dbNamePattern: 'oniru' },
  { id: '11', slug: 'palmslekki', dbNamePattern: 'palms lekki' },
  { id: '12', slug: 'benin', dbNamePattern: 'benin' },
  { id: '4', slug: 'dugbe', dbNamePattern: 'dugbe' },
];

async function fetchActiveDates(): Promise<string[]> {
  const result = await apiRequest({
    endpoint: 'cms_widget/index',
    method: 'POST',
    data: {
      api: 'dates',
      sales_channel_id: 1,
      cinema_location_id: '6',
      page_number: '1',
      url_key: '',
      widget_id: 'movie_calendar',
      calendar_date_picker_option: '2',
    },
    headers: {},
    langId: '1',
  });

  if (!result?.status || !result.data?.date_start || !result.data?.date_end) {
    throw new Error('Filmhouse did not return an active date range');
  }

  const disabled = new Set((result.data.date_disabled || []).map((item: any) => item.date));
  const dates: string[] = [];
  const cursor = new Date(result.data.date_start);
  const end = new Date(result.data.date_end);

  while (cursor <= end && dates.length < 10) {
    const date = cursor.toISOString().slice(0, 10);
    if (!disabled.has(date)) dates.push(date);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function fetchLocationShowtimes(locationId: string, dates: string[]): Promise<ScrapedShowtime[]> {
  const rows: ScrapedShowtime[] = [];

  for (const date of dates) {
    const result = await apiRequest({
      endpoint: 'cms_widget/index',
      method: 'POST',
      data: {
        api: 'list',
        sales_channel_id: 1,
        cinema_location_id: locationId,
        widget_id: 'movie_calendar',
        session_date: date,
        has_limit: 0,
        per_page: 100,
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
      const title = cleanCinemaListingTitle(movie.movie_name || movie.title || '');
      if (!title) continue;
      const metadata = filmMeta(movie);

      for (const slot of movie.show_times || movie.showtimes || []) {
        const showTime = convertTimeTo24h(slot.show_time_slots || slot.show_time || '');
        if (!showTime) continue;
        const screenName = slot.screen_name ?? slot.screen ?? slot.theater_experiance_name ?? null;

        rows.push({
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

  return rows;
}

async function scrapeFilmhouse() {
  const startedAt = Date.now();
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'filmhouse',
    status: 'running',
    message: 'Syncing Filmhouse API showtimes...',
    details: { started_at: new Date().toISOString() },
  }).select('id').single();

  let processedTitles = 0;
  let insertedShowtimes = 0;
  let pendingTitles = 0;
  let failures = 0;

  try {
    const { data: cinemas, error: cinemasError } = await supabase
      .from('cinemas')
      .select('id,name,scrape_enabled')
      .ilike('name', '%filmhouse%');
    if (cinemasError) throw cinemasError;

    const mappings = LOCATION_MAPPINGS.map(mapping => {
      const cinema = cinemas?.find(item => item.scrape_enabled && item.name.toLowerCase().includes(mapping.dbNamePattern))
        ?? cinemas?.find(item => item.name.toLowerCase().includes(mapping.dbNamePattern));
      return cinema ? { ...mapping, cinemaId: cinema.id, cinemaName: cinema.name } : null;
    }).filter(Boolean) as Array<(typeof LOCATION_MAPPINGS)[number] & { cinemaId: string; cinemaName: string }>;

    const dates = await fetchActiveDates();
    console.log(`Filmhouse: ${mappings.length} locations, ${dates.length} active dates`);

    for (const mapping of mappings) {
      try {
        const scraped = await fetchLocationShowtimes(mapping.id, dates);
        const uniqueTitles = new Set(scraped.map(row => row.filmTitle));
        const result = await upsertShowtimes(mapping.cinemaId, scraped, 'filmhouse_cinesync');

        processedTitles += uniqueTitles.size;
        insertedShowtimes += result.matched_showtimes;
        pendingTitles += result.unmatched_titles;

        await supabase.from('cinemas').update({
          showtimes_last_fetched_at: new Date().toISOString(),
          scrape_failure_count: 0,
        }).eq('id', mapping.cinemaId);

        console.log(`  ${mapping.cinemaName}: ${scraped.length} raw, ${result.matched_showtimes} matched, ${result.unmatched_titles} pending`);
      } catch (error: any) {
        failures += 1;
        await supabase.from('cinemas').update({
          scrape_failure_count: 1,
        }).eq('id', mapping.cinemaId);
        console.error(`  ${mapping.cinemaName}: ${error.message}`);
      }
    }

    await sweepStaleCinemas();
    const status = failures === 0 ? 'success' : failures < mappings.length ? 'partial' : 'error';
    const message = `Filmhouse sync complete. ${insertedShowtimes} showtimes, ${pendingTitles} pending titles, ${failures} failed locations.`;

    if (logEntry?.id) {
      await supabase.from('sync_logs').update({
        status,
        message,
        details: { processed_titles: processedTitles, inserted_showtimes: insertedShowtimes, pending_titles: pendingTitles, failures },
        duration_ms: Date.now() - startedAt,
        items_processed: processedTitles,
        items_updated: insertedShowtimes,
        items_failed: failures,
      }).eq('id', logEntry.id);
    }

    console.log(message);
    if (status === 'error') process.exitCode = 1;
  } catch (error: any) {
    if (logEntry?.id) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: error.message,
        details: { error: error.stack },
        duration_ms: Date.now() - startedAt,
        items_failed: 1,
      }).eq('id', logEntry.id);
    }
    console.error('Filmhouse sync failed:', error);
    process.exitCode = 1;
  }
}

await scrapeFilmhouse();
