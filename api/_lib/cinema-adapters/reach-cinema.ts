/**
 * Reach Cinema / Fusion Intel adapter — covers Viva, Ozone, KADA.
 *
 * They all share the `max-api-readonly.fusionintel.io` backend. Each chain has
 * its own circuitId, and each cinema has an external cinemaId like "viv-6ac91519".
 * The JWT is a public bearer token bundled in the web app's JS (no secret).
 *
 * cinemas.scrape_config must include:
 *   { "externalCinemaId": "viv-6ac91519", "bookingBaseUrl": "https://web.vivacinemas.com" }
 *
 * Optionally override globals per cinema:
 *   { "apiBase": "...", "jwt": "..." }
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types.js';
import { inferFormat, toLagosDateTime, todayLagos } from './types.js';

// Public bearer JWT bundled in web.vivacinemas.com (exp: 2027-06-05).
// If Reach Cinema ever rotates it, set REACH_CINEMA_JWT env var to override.
const DEFAULT_JWT =
  process.env.REACH_CINEMA_JWT ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiQ2luZW1hQXBpIiwiQ2luZW1hSWQiOiJ2aXYtMjdmZDQxZGMiLCJuYmYiOjE3NzAzOTkwNjAsImV4cCI6MTgwMTkzNTA2MCwiaWF0IjoxNzcwMzk5MDYwLCJpc3MiOiJodHRwczovL2Z1c2lvbmludGVsLmlvIiwiYXVkIjoiVXNlciJ9.BivgaldX_3fh-iwGNlbGeIHcC4TF9QmlT7-nGfjHoEs';

const DEFAULT_API_BASE = 'https://max-api-readonly.fusionintel.io/api/v1';
const DEFAULT_BOOKING_BASE = 'https://web.vivacinemas.com';
const LOOKAHEAD_DAYS = 7; // how far out we pull showtimes

// Raw shape of a showtime object returned by /Showtimes/get-showtimes
interface ReachShowtimeDTO {
  id: string;
  cinemaId: string;
  cinema?: string;
  screenId?: string;
  screen?: string;
  filmId: string;
  film: string;
  filmRating?: string | null;
  posterUrl?: string | null;
  shortSynopsis?: string | null;
  startTime: string;   // ISO UTC
  endTime?: string;
  totalSeats?: number;
  seatsSold?: number;
  priceCard?: {
    tickets?: Array<{ price?: number; ticketName?: string; shortName?: string }>;
  };
}

// Browser UA for the proxied retry — Cloudflare challenges the plain sync UA.
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Build a SmartProxy dispatcher if SMARTPROXY_* env is present, else null. */
async function proxyDispatcher(): Promise<unknown | null> {
  const { SMARTPROXY_HOST, SMARTPROXY_PORT, SMARTPROXY_USER, SMARTPROXY_PASS } = process.env;
  if (!SMARTPROXY_HOST || !SMARTPROXY_PORT || !SMARTPROXY_USER || !SMARTPROXY_PASS) return null;
  const { ProxyAgent } = await import('undici');
  return new ProxyAgent({
    uri: `http://${SMARTPROXY_HOST}:${SMARTPROXY_PORT}`,
    token: 'Basic ' + Buffer.from(`${SMARTPROXY_USER}:${SMARTPROXY_PASS}`).toString('base64'),
  });
}

// Cloudflare interstitial ("Just a moment…") comes back as 403/503 with an HTML body.
function isCloudflareChallenge(status: number, body: string): boolean {
  return (status === 403 || status === 503) && /Just a moment|challenge-platform|cf-mitigated/i.test(body);
}

async function fetchJson<T = any>(url: string, jwt: string): Promise<T> {
  const direct = await fetch(url, {
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/json',
      'User-Agent': 'MuviDB-Cinema-Sync/1.0',
    },
  });
  if (direct.ok) return direct.json() as Promise<T>;

  const body = await direct.text().catch(() => '');

  // Retry through SmartProxy on a Cloudflare challenge (datacenter IPs get blocked).
  if (isCloudflareChallenge(direct.status, body)) {
    const dispatcher = await proxyDispatcher();
    if (dispatcher) {
      const proxied = await fetch(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/json',
          'User-Agent': BROWSER_UA,
        },
        dispatcher,
      } as RequestInit & { dispatcher: unknown });
      if (proxied.ok) return proxied.json() as Promise<T>;
      const pBody = await proxied.text().catch(() => '');
      throw new Error(`Reach Cinema ${proxied.status} (via proxy) @ ${url} :: ${pBody.slice(0, 200)}`);
    }
  }

  throw new Error(`Reach Cinema ${direct.status} @ ${url} :: ${body.slice(0, 200)}`);
}

/** Find the lowest adult/standard ticket price in a priceCard. */
function cheapestPrice(pc?: ReachShowtimeDTO['priceCard']): number | null {
  if (!pc?.tickets?.length) return null;
  const prices = pc.tickets.map(t => t.price).filter((p): p is number => typeof p === 'number');
  if (!prices.length) return null;
  return Math.min(...prices);
}

export const reachCinemaAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const externalId: string | undefined = cfg.externalCinemaId;
  if (!externalId) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'scrape_config.externalCinemaId is required for reach_cinema adapter',
    };
  }

  const apiBase     = cfg.apiBase     || DEFAULT_API_BASE;
  const bookingBase = cfg.bookingBaseUrl || DEFAULT_BOOKING_BASE;
  const jwt         = cfg.jwt         || DEFAULT_JWT;

  const dateFrom = todayLagos(0);
  const dateTo   = todayLagos(LOOKAHEAD_DAYS);

  // PascalCase DateFrom/DateTo is required — lowercase silently returns empty data
  const url = `${apiBase}/Showtimes/get-showtimes?cinemaId=${encodeURIComponent(
    externalId,
  )}&DateFrom=${dateFrom}&DateTo=${dateTo}`;

  let raw: { data?: ReachShowtimeDTO[]; errors?: unknown[] };
  try {
    raw = await fetchJson(url, jwt);
  } catch (err: any) {
    return { cinemaId: cinema.id, showtimes: [], error: err.message };
  }

  const dtos = Array.isArray(raw.data) ? raw.data : [];
  const showtimes: ScrapedShowtime[] = dtos
    .filter(d => d.startTime && d.filmId && d.film)
    .map(d => {
      const { showDate, showTime } = toLagosDateTime(d.startTime);
      return {
        externalFilmId: d.filmId,
        filmTitle: d.film,
        filmMeta: {
          posterUrl: d.posterUrl ?? null,
          synopsis: d.shortSynopsis ?? null,
          rating: d.filmRating ?? null,
        },
        showDate,
        showTime,
        format: inferFormat(d.screen),
        screenName: d.screen ?? null,
        // Ticket deep-link — the web app uses /showtimes?showtimeId=<id>
        ticketUrl: `${bookingBase.replace(/\/$/, '')}/showtimes?showtimeId=${d.id}&cinemaId=${externalId}`,
        price: cheapestPrice(d.priceCard),
      };
    });

  return {
    cinemaId: cinema.id,
    showtimes,
    warnings: raw.errors && Array.isArray(raw.errors) && raw.errors.length
      ? raw.errors.map(e => String(e))
      : undefined,
  };
};
