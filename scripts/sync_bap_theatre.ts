import * as cheerio from 'cheerio';
import { supabase } from './lib/db';
import { startSyncLog } from './lib/sync';

const BASE_URL = 'https://app.bapproduction.com';
const SOURCE = 'bap-theatre';
const DRY_RUN = process.argv.includes('--dry-run');

type DateRange = {
  start: string;
  end: string;
};

type PlayPayload = {
  title: string;
  slug: string;
  playwright: string | null;
  director: string | null;
  producer: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  poster_url: string | null;
  banner_url: string | null;
  synopsis: string | null;
  genre: string | null;
  year: number | null;
  run_start_date: string | null;
  run_end_date: string | null;
  status: string;
  performance_time: string | null;
  source_url: string;
  updated_at: string;
};

const KNOWN_URLS = [
  'https://app.bapproduction.com/productions/dear-kaffy-london',
];

const KNOWN_OVERRIDES: Record<string, Partial<PlayPayload>> = {
  'dear-kaffy-london': {
    genre: 'Stage Play',
    venue: 'Shaw Theatre, London',
    city: 'London',
    country: 'United Kingdom',
    performance_time: '3:00 PM & 7:00 PM',
  },
};

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function makeSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleKey(value: string) {
  return makeSlug(value.replace(/\b(the|stage|adaptation|play|musical)\b/gi, ''));
}

function toIsoDate(year: string | number, monthName: string, day: string | number) {
  const month = MONTHS[String(monthName).toLowerCase()];
  if (!month) return null;
  return `${year}-${month}-${String(day).padStart(2, '0')}`;
}

function parseDateRange(text: string): DateRange | null {
  const monthFirst = text.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:\s*[-\u2013]\s*(\d{1,2}))?,\s*(\d{4})\b/i
  );
  if (monthFirst) {
    const start = toIsoDate(monthFirst[4], monthFirst[1], monthFirst[2]);
    const end = toIsoDate(monthFirst[4], monthFirst[1], monthFirst[3] || monthFirst[2]);
    return start && end ? { start, end } : null;
  }

  const dayFirst = text.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i
  );
  if (dayFirst) {
    const date = toIsoDate(dayFirst[3], dayFirst[2], dayFirst[1]);
    return date ? { start: date, end: date } : null;
  }

  return null;
}

function formatTime(raw: string) {
  const match = raw.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return clean(raw).toUpperCase();
  const hour = String(Number(match[1]));
  return `${hour}:${match[2]} ${match[3].toUpperCase()}`;
}

function parsePerformanceTime(text: string) {
  const times = new Set<string>();
  const timeRangeRe = /\b(\d{1,2}:\d{2}\s*(?:am|pm))\s*[-\u2013]\s*\d{1,2}:\d{2}\s*(?:am|pm)\b/gi;
  for (const match of text.matchAll(timeRangeRe)) {
    times.add(formatTime(match[1]));
  }
  return times.size ? Array.from(times).join(' & ') : null;
}

function parseVenue(text: string) {
  const venueMatch = text.match(/\bVenue\s+(.+?)\s+(?:Dates?|Ticket|Age Guidance|Show Times|Book Your Seat)\b/i);
  if (venueMatch) return clean(venueMatch[1]);
  if (/Shaw Theatre(?:,|\s+)London/i.test(text)) return 'Shaw Theatre, London';
  if (/Terra Kulture/i.test(text)) return 'Terra Kulture Arena';
  return null;
}

function locationFromVenue(venue: string | null, text: string) {
  const haystack = `${venue || ''} ${text}`;
  if (/London/i.test(haystack)) return { city: 'London', country: 'United Kingdom' };
  if (/Lagos|Victoria Island|Ikoyi|Terra Kulture/i.test(haystack)) return { city: 'Lagos', country: 'Nigeria' };
  return { city: null, country: 'Nigeria' };
}

function statusFor(start: string | null, end: string | null) {
  if (!start || !end) return 'archived';
  const today = (process.env.MUVIDB_SYNC_TODAY || new Date().toISOString().slice(0, 10)).slice(0, 10);
  if (end < today) return 'archived';
  if (start <= today && end >= today) return 'currently_running';
  return 'upcoming';
}

function resolveUrl(value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value, BASE_URL).toString();
  } catch {
    return null;
  }
}

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'MuviDB theatre monitor (+https://muvidb.com)',
      accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

async function discoverUrls() {
  const urls = new Set(KNOWN_URLS);
  const landingPages = [`${BASE_URL}/`, `${BASE_URL}/theatre`];

  for (const pageUrl of landingPages) {
    try {
      const html = await fetchHtml(pageUrl);
      const $ = cheerio.load(html);
      $('a[href]').each((_, link) => {
        const href = resolveUrl($(link).attr('href'));
        if (!href) return;
        const url = new URL(href);
        if (url.origin !== BASE_URL) return;
        if (/\/(?:productions|theatre)\//.test(url.pathname)) urls.add(url.toString());
      });
    } catch (error: any) {
      console.warn(`Could not discover BAP URLs from ${pageUrl}: ${error.message}`);
    }
  }

  for (const arg of process.argv) {
    if (arg.startsWith('--url=')) urls.add(arg.slice('--url='.length));
  }

  return Array.from(urls).sort();
}

function isTheatrePage(title: string, text: string, url: string) {
  if (/reviews?|audience reactions?|gallery|pictures|press|news/i.test(title)) return false;
  if (/festival/i.test(title)) return false;
  if (/\/theatre\//.test(url)) return true;
  if (/Feature Film/i.test(text) && !/stage|theatre|musical|play|performance/i.test(text)) return false;
  return /theatre|stage|musical|play|performance|Shaw Theatre/i.test(text);
}

function parsePlay(url: string, html: string): PlayPayload | null {
  const $ = cheerio.load(html);
  const title = clean($('h1').first().text());
  if (!title) return null;

  const text = clean($('body').text());
  const slug = makeSlug(title);
  if (!isTheatrePage(title, text, url)) return null;

  const dates = parseDateRange(text);
  if (!dates) return null;

  const venue = parseVenue(text);
  const location = locationFromVenue(venue, text);
  const image = $('img')
    .toArray()
    .map((img) => ({
      src: resolveUrl($(img).attr('src')),
      alt: clean($(img).attr('alt')),
    }))
    .find((img) => img.src && img.alt.toLowerCase().includes(title.toLowerCase()))?.src || null;
  const synopsis = clean($('meta[name="description"]').attr('content')) || null;
  const override = KNOWN_OVERRIDES[slug] || {};

  return {
    title,
    slug,
    playwright: null,
    director: null,
    producer: 'BAP Productions',
    venue,
    city: location.city,
    country: location.country,
    poster_url: image,
    banner_url: image,
    synopsis,
    genre: /musical/i.test(title) ? 'Musical' : 'Stage Play',
    year: Number(dates.start.slice(0, 4)),
    run_start_date: dates.start,
    run_end_date: dates.end,
    status: statusFor(dates.start, dates.end),
    performance_time: parsePerformanceTime(text),
    source_url: url,
    updated_at: new Date().toISOString(),
    ...override,
  };
}

async function upsertPlay(payload: PlayPayload, counters: { processed: number; created: number; updated: number; failed: number }) {
  counters.processed++;
  const { data: existing, error: fetchError } = await supabase
    .from('plays')
    .select('id,title,slug')
    .or(`slug.eq.${payload.slug},title.eq.${payload.title}`)
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (DRY_RUN) {
    console.log(`${existing ? 'would update' : 'would insert'}: ${payload.title} (${payload.source_url})`);
    return;
  }

  if (existing) {
    const { error } = await supabase.from('plays').update(payload).eq('id', existing.id);
    if (error) throw error;
    counters.updated++;
    console.log(`updated: ${payload.title}`);
    return;
  }

  const { error } = await supabase.from('plays').insert(payload);
  if (error) throw error;
  counters.created++;
  console.log(`inserted: ${payload.title}`);
}

async function main() {
  const log = DRY_RUN ? null : await startSyncLog(SOURCE, 'Syncing BAP theatre productions...');
  const counters = log?.counters || { processed: 0, created: 0, updated: 0, failed: 0 };

  try {
    const urls = await discoverUrls();
    console.log(`Discovered ${urls.length} BAP production/theatre URLs${DRY_RUN ? ' [DRY RUN]' : ''}`);
    const seenSlugs = new Set<string>();

    for (const url of urls) {
      try {
        const html = await fetchHtml(url);
        const play = parsePlay(url, html);
        if (!play) continue;
        if (seenSlugs.has(play.slug)) continue;
        seenSlugs.add(play.slug);
        await upsertPlay(play, counters);
      } catch (error: any) {
        counters.failed++;
        console.warn(`failed: ${url}: ${error.message}`);
      }
    }

    const message = `BAP theatre sync complete: ${counters.created} created, ${counters.updated} updated, ${counters.failed} failed.`;
    console.log(message);
    await log?.finish(message);
  } catch (error: any) {
    await log?.fail(error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
