/**
 * Cinesync adapter — covers Filmhouse Cinemas (and any chain on the Cinesync
 * platform by EAD Systems).
 *
 * ─────────────────────────────────────────────────────────────────
 * ⚠️  CURRENT STATUS: STUB — Cinesync API uses encrypted payloads
 * ─────────────────────────────────────────────────────────────────
 * filmhouseng.com (correct URL as of 2026) proxies all booking calls
 * through its own /api/external endpoint with AES-encrypted payloads.
 * The encryption key is server-side only — we cannot reverse-engineer it.
 *
 * RECOMMENDED WORKAROUND: Use the firecrawl adapter instead.
 * Set scrape_adapter='firecrawl' on each Filmhouse cinema row and set
 * scrape_config.url to the per-location movies page, e.g.:
 *   https://www.filmhouseng.com/en/cinemas/lekki/movies
 *
 * This adapter stub remains for the day when either:
 *   a) Cinesync offers a public/partner API, or
 *   b) Someone extracts the encryption key via a native app binary
 *
 * ─────────────────────────────────────────────────────────────────
 * CONFIGURATION (scrape_config JSON on the cinemas row)
 * ─────────────────────────────────────────────────────────────────
 *   {
 *     "apiBase":    "https://api.cinesync.io/v1",   // required
 *     "cinemaSlug": "filmhouse-lekki",              // required — site/cinema identifier
 *     "apiKey":     "pk_live_...",                  // if required by the platform
 *     "bookingBase":"https://www.filmhouseng.com"   // for ticket deep-links
 *   }
 *
 * ─────────────────────────────────────────────────────────────────
 * KNOWN FILMHOUSE LOCATIONS (add to cinemas table via seed script)
 * ─────────────────────────────────────────────────────────────────
 *   Filmhouse Cinemas Lekki (Palms Shopping Mall)
 *   Filmhouse Cinemas Ikeja GRA
 *   Filmhouse Cinemas Surulere
 *   Filmhouse Cinemas Abuja (Jabi)
 *   Filmhouse Cinemas Port Harcourt
 *   Filmhouse Cinemas Kano
 *
 * ─────────────────────────────────────────────────────────────────
 * STATUS: STUB — needs API endpoint from DevTools recon
 * ─────────────────────────────────────────────────────────────────
 * filmhousecinemas.com consistently refuses connections from outside
 * Nigeria (geo-blocked). To complete this adapter:
 *
 * Option A — Use a Nigerian VPS/proxy to probe the site:
 *   curl -v 'https://filmhousecinemas.com/movies' --user-agent 'Mozilla/5.0'
 *
 * Option B — Run scripts/_probe-filmhouse.mjs locally in Nigeria:
 *   node scripts/_probe-filmhouse.mjs
 *
 * Option C — Use the firecrawl adapter as a fallback until the API
 * endpoint is known (set scrape_adapter='firecrawl' on the cinema row
 * and scrape_config.url = 'https://filmhousecinemas.com/cinemas/<slug>').
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types';
import { inferFormat, toLagosDateTime, todayLagos } from './types';

// ── DTO shapes (update once real API is confirmed) ────────────────────────────

interface CinesyncFilm {
  id: string;
  title: string;
  posterUrl?: string | null;
  synopsis?: string | null;
  rating?: string | null;
  runtimeMinutes?: number | null;
}

interface CinesyncSession {
  id: string;
  filmId: string;
  cinemaId: string;
  screenName?: string;
  startTime: string;  // ISO UTC or local "YYYY-MM-DDTHH:MM:SS"
  isAvailable?: boolean;
  priceFrom?: number | null;
  attributes?: string[];   // e.g. ["3D", "IMAX"]
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const cinesyncAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const apiBase:    string | undefined = cfg.apiBase;
  const cinemaSlug: string | undefined = cfg.cinemaSlug || cfg.cinemaId;

  if (!apiBase) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error:
        'cinesync adapter: scrape_config.apiBase is not set. ' +
        'Run DevTools recon on filmhousecinemas.com to find the API endpoint — ' +
        'see the comment block at the top of api/_lib/cinema-adapters/cinesync.ts.',
    };
  }

  if (!cinemaSlug) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'cinesync adapter: scrape_config.cinemaSlug (or cinemaId) is required.',
    };
  }

  const bookingBase: string = cfg.bookingBase || 'https://filmhousecinemas.com';
  const apiKey: string | undefined = cfg.apiKey || process.env.FILMHOUSE_API_KEY;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'Lumi-Cinema-Sync/1.0',
  };
  if (apiKey) headers['x-api-key'] = apiKey;

  const dateFrom = todayLagos(0);
  const dateTo   = todayLagos(7);

  // ── Sessions endpoint (adjust path once confirmed via DevTools) ──────────────
  // Common Cinesync patterns — try the one that works:
  //   /sessions?cinemaId=<slug>&dateFrom=<date>&dateTo=<date>
  //   /showtimes?site=<slug>&from=<date>&to=<date>
  //   /cinemas/<slug>/sessions?from=<date>&to=<date>
  const sessionsUrl =
    `${apiBase.replace(/\/$/, '')}/sessions?cinemaId=${encodeURIComponent(cinemaSlug)}` +
    `&dateFrom=${dateFrom}&dateTo=${dateTo}`;

  let sessions: CinesyncSession[];
  let filmMap: Record<string, CinesyncFilm> = {};

  try {
    const r = await fetch(sessionsUrl, { headers });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      return {
        cinemaId: cinema.id,
        showtimes: [],
        error: `Cinesync ${r.status} @ ${sessionsUrl} :: ${body.slice(0, 300)}`,
      };
    }
    const json = await r.json() as any;

    // Cinesync responses vary — handle both wrapped and bare arrays
    const rawSessions: any[] = Array.isArray(json)
      ? json
      : (json.sessions ?? json.data?.sessions ?? json.data ?? []);

    sessions = rawSessions.filter(
      (s: any) => s.id && s.filmId && s.startTime,
    ) as CinesyncSession[];

    // Some Cinesync endpoints include film metadata inline; others need a second call.
    // Try inline first:
    const inlineFilms: any[] = json.films ?? json.data?.films ?? [];
    for (const f of inlineFilms) {
      if (f.id) filmMap[f.id] = f as CinesyncFilm;
    }

    // If no inline films, fetch the films endpoint
    if (Object.keys(filmMap).length === 0 && sessions.length > 0) {
      const uniqueFilmIds = [...new Set(sessions.map(s => s.filmId))];
      // Fetch up to 20 films — tweak the endpoint path as needed
      const filmsUrl = `${apiBase.replace(/\/$/, '')}/films?ids=${uniqueFilmIds.slice(0, 20).join(',')}`;
      try {
        const fr = await fetch(filmsUrl, { headers });
        if (fr.ok) {
          const fj = await fr.json() as any;
          const films: any[] = Array.isArray(fj) ? fj : (fj.films ?? fj.data ?? []);
          for (const f of films) { if (f.id) filmMap[f.id] = f; }
        }
      } catch { /* ignore — film metadata is optional */ }
    }
  } catch (err: any) {
    return { cinemaId: cinema.id, showtimes: [], error: err.message };
  }

  const showtimes: ScrapedShowtime[] = sessions.map(s => {
    const film = filmMap[s.filmId] ?? null;

    // startTime may be UTC ISO or local — we try UTC first, fall back to treating as Lagos
    let showDate: string, showTime: string;
    try {
      const dt = toLagosDateTime(s.startTime);
      showDate = dt.showDate;
      showTime = dt.showTime;
    } catch {
      // If startTime is already local (no Z suffix), slice directly
      const local = s.startTime.replace('T', ' ');
      showDate = local.slice(0, 10);
      showTime = local.slice(11, 19).padEnd(8, ':00');
    }

    const formatFromAttr = s.attributes?.find(a =>
      ['IMAX','3D','4DX','VIP','RECLINER'].includes(a.toUpperCase())
    );
    const format = inferFormat(s.screenName ?? formatFromAttr ?? null);

    return {
      externalFilmId: s.filmId,
      filmTitle: film?.title ?? s.filmId,
      filmMeta: film
        ? {
            posterUrl:      film.posterUrl    ?? null,
            synopsis:       film.synopsis     ?? null,
            rating:         film.rating       ?? null,
            runtimeMinutes: film.runtimeMinutes ?? null,
          }
        : undefined,
      showDate,
      showTime,
      format,
      screenName: s.screenName ?? null,
      ticketUrl:  `${bookingBase.replace(/\/$/, '')}/book/${s.id}`,
      price: s.priceFrom ?? null,
    };
  });

  return { cinemaId: cinema.id, showtimes };
};
