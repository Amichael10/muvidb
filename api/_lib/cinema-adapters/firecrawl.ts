/**
 * Firecrawl adapter — fallback for cinemas whose websites block server-side
 * fetch (e.g. Genesis Cinemas, which ECONNREFUSED from non-Nigerian IPs).
 *
 * Uses Firecrawl's /extract endpoint with an LLM schema to pull structured
 * showtime data from any cinema's now-showing/movies page. One Firecrawl
 * "scrape + extract" call consumes ~5 credits on the free plan (500/mo).
 * At 7 locations × 1 scrape/day = ~210 credits/month — comfortably free.
 *
 * cinemas.scrape_config must include:
 *   { "url": "https://genesiscinemas.com.ng/movies" }
 *
 * Optional overrides:
 *   { "ticketBaseUrl": "https://genesiscinemas.com.ng/book" }
 *
 * Requires env var:
 *   FIRECRAWL_API_KEY=fc-...
 */

import type { AdapterResult, CinemaAdapter, CinemaRow, ScrapedShowtime } from './types';
import { inferFormat, todayLagos } from './types';

/** The shape we ask Firecrawl to extract from each page. */
interface ExtractedSchedule {
  films: Array<{
    /** Film title as displayed on the site */
    title: string;
    /** Poster image URL if visible */
    poster_url?: string | null;
    /** Rating/censor certificate if shown (e.g. "PG", "18") */
    rating?: string | null;
    /** All showtimes for this film */
    showtimes: Array<{
      /** Show date in YYYY-MM-DD or human form like "Today", "Saturday April 19" */
      date?: string | null;
      /** Show time in any format — we'll normalize it (e.g. "6:00pm", "18:00") */
      time: string;
      /** Screen/hall name if shown */
      screen?: string | null;
      /** Format indicator if shown (IMAX, 3D, 4DX, Standard, etc.) */
      format?: string | null;
      /** Ticket/booking URL for this specific showtime if available */
      ticket_url?: string | null;
    }>;
  }>;
}

/** Normalize times like "6:00pm", "18:00", "6pm", "18:00:00" → "HH:MM:SS" */
function normalizeTime(raw: string): string | null {
  const s = raw.trim();

  // 12-hour: "6:00pm", "6:00 PM", "6pm"
  const m12 = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    let hr = parseInt(m12[1], 10);
    const min = parseInt(m12[2] ?? '0', 10);
    const ampm = m12[3].toLowerCase();
    if (ampm === 'am') { if (hr === 12) hr = 0; }
    else               { if (hr !== 12) hr += 12; }
    return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
  }

  // 24-hour: "18:00", "18:00:00"
  const m24 = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const hr  = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (hr >= 0 && hr <= 23 && min >= 0 && min <= 59) {
      return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
    }
  }

  return null;
}

/**
 * Interpret date strings like "Today", "Tomorrow", "Saturday April 19",
 * "April 19", or "2025-04-19" → "YYYY-MM-DD" in Lagos time.
 * Falls back to today if unparseable.
 */
function normalizeDate(raw: string | null | undefined, fallback: string): string {
  if (!raw) return fallback;
  const s = raw.trim().toLowerCase();

  if (s === 'today')    return fallback;
  if (s === 'tomorrow') return todayLagos(1);

  // Try ISO directly
  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return raw.trim().slice(0, 10);

  // "Saturday April 19" or "April 19, 2026" or "April 19"
  const MONTHS = ['january','february','march','april','may','june',
                  'july','august','september','october','november','december'];
  const monthRe = new RegExp(`(${MONTHS.join('|')})\\s+(\\d{1,2})(?:[,\\s]+(\\d{4}))?`, 'i');
  const mm = s.match(monthRe);
  if (mm) {
    const monthIdx = MONTHS.indexOf(mm[1].toLowerCase());
    const day = parseInt(mm[2], 10);
    const nowLagos = new Date(Date.now() + 3600000);
    const year = mm[3] ? parseInt(mm[3], 10) : nowLagos.getUTCFullYear();
    return `${year}-${String(monthIdx + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }

  return fallback;
}

export const firecrawlAdapter: CinemaAdapter = async (cinema: CinemaRow): Promise<AdapterResult> => {
  const cfg = cinema.scrape_config || {};
  const url: string | undefined = cfg.url;
  if (!url) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'scrape_config.url is required for firecrawl adapter',
    };
  }

  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    return {
      cinemaId: cinema.id,
      showtimes: [],
      error: 'FIRECRAWL_API_KEY env var is not set',
    };
  }

  const ticketBaseUrl: string = cfg.ticketBaseUrl || '';

  // Call Firecrawl extract endpoint
  let extracted: ExtractedSchedule;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/extract', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [url],
        prompt: `Extract all currently showing films and their showtimes from this cinema website.
For each film, return:
- title (exact as shown)
- poster_url (absolute URL if visible, else null)
- rating (age/censor certificate if shown, e.g. "PG", "18", else null)
- showtimes array, where each showtime has:
  - date (the date this showtime occurs: "Today", a day name, or YYYY-MM-DD; null if not shown)
  - time (the time in any format, e.g. "6:00pm", "18:00")
  - screen (screen/hall name if shown, else null)
  - format (e.g. "IMAX", "3D", "4DX", "Standard", null if not shown)
  - ticket_url (direct booking link for this showtime if available, else null)

Important: include ALL films and ALL their time slots. Do not omit any.`,
        schema: {
          type: 'object',
          properties: {
            films: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title:      { type: 'string' },
                  poster_url: { type: ['string', 'null'] },
                  rating:     { type: ['string', 'null'] },
                  showtimes:  {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date:       { type: ['string', 'null'] },
                        time:       { type: 'string' },
                        screen:     { type: ['string', 'null'] },
                        format:     { type: ['string', 'null'] },
                        ticket_url: { type: ['string', 'null'] },
                      },
                      required: ['time'],
                    },
                  },
                },
                required: ['title', 'showtimes'],
              },
            },
          },
          required: ['films'],
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return {
        cinemaId: cinema.id,
        showtimes: [],
        error: `Firecrawl extract HTTP ${res.status}: ${body.slice(0, 300)}`,
      };
    }

    const json = await res.json() as { success?: boolean; data?: ExtractedSchedule; error?: string };
    if (!json.success || !json.data) {
      return {
        cinemaId: cinema.id,
        showtimes: [],
        error: `Firecrawl extract returned no data: ${json.error ?? JSON.stringify(json).slice(0, 200)}`,
      };
    }

    extracted = json.data;
  } catch (err: any) {
    return { cinemaId: cinema.id, showtimes: [], error: err.message };
  }

  const today = todayLagos(0);
  const showtimes: ScrapedShowtime[] = [];
  const warnings: string[] = [];

  for (const film of extracted.films ?? []) {
    if (!film.title?.trim()) continue;

    for (const st of film.showtimes ?? []) {
      const showTime = normalizeTime(st.time);
      if (!showTime) {
        warnings.push(`Could not parse time "${st.time}" for film "${film.title}"`);
        continue;
      }

      const showDate = normalizeDate(st.date, today);
      const format   = inferFormat(st.screen ?? st.format ?? null) !== 'Standard'
                         ? inferFormat(st.screen ?? null)
                         : (SCREEN_FORMAT_LABELS[st.format?.toUpperCase() ?? ''] ?? 'Standard');

      const ticketUrl = st.ticket_url
        || (ticketBaseUrl ? ticketBaseUrl : null);

      showtimes.push({
        externalFilmId: `fc-${film.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        filmTitle: film.title.trim(),
        filmMeta: {
          posterUrl: film.poster_url ?? null,
          rating: film.rating ?? null,
        },
        showDate,
        showTime,
        format,
        screenName: st.screen ?? null,
        ticketUrl: ticketUrl ?? null,
      });
    }
  }

  return {
    cinemaId: cinema.id,
    showtimes,
    warnings: warnings.length ? warnings : undefined,
  };
};

// Supplemental format labels from Firecrawl LLM output (when not in screen name)
const SCREEN_FORMAT_LABELS: Record<string, string> = {
  'IMAX': 'IMAX',
  '4DX':  '4DX',
  '3D':   '3D',
  'VIP':  'VIP',
  'RECLINER': 'Recliner',
  'STANDARD': 'Standard',
  'PREMIUM':  'VIP',
};
