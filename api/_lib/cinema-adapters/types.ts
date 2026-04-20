/**
 * Shared types for cinema showtime scraper adapters.
 *
 * Each adapter implements `fetchShowtimes(cinema)` and returns a flat array of
 * ScrapedShowtime objects — one per (film × screen × time). The cron endpoint
 * then runs these through the shared match/upsert pipeline in ./upsert.ts.
 */

/** A row in the `cinemas` table — only the columns the adapters need. */
export interface CinemaRow {
  id: string;                   // Supabase UUID
  name: string;
  chain: string | null;
  city: string | null;
  booking_url: string | null;
  scrape_adapter: string | null;
  scrape_config: Record<string, any> | null;
  showtimes_last_fetched_at: string | null;
  scrape_failure_count: number | null;
}

/** A single showtime as extracted by an adapter, before DB matching. */
export interface ScrapedShowtime {
  /** External film identifier from the source site (string ID, slug, or title hash). */
  externalFilmId: string;
  /** Film title as displayed on the source site (raw — we'll normalize downstream). */
  filmTitle: string;
  /** Optional film metadata an adapter happens to know — helps us create a better film row if needed. */
  filmMeta?: {
    synopsis?: string | null;
    posterUrl?: string | null;
    backdropUrl?: string | null;
    trailerUrl?: string | null;
    runtimeMinutes?: number | null;
    rating?: string | null;        // e.g. "PG-13", "18"
    releaseYear?: number | null;
    genres?: string[];
  };

  /** Showtime itself, in local Nigeria time. */
  showDate: string;   // YYYY-MM-DD  (Africa/Lagos)
  showTime: string;   // HH:MM:SS    (24-hour, Africa/Lagos)
  format: string;     // 'Standard' | '3D' | 'IMAX' | 'VIP' | 'Recliner' | ...
  screenName?: string | null;
  ticketUrl?: string | null;
  price?: number | null;
}

/** Result returned by each adapter run. */
export interface AdapterResult {
  cinemaId: string;           // Supabase cinemas.id
  showtimes: ScrapedShowtime[];
  /** Non-fatal warnings an adapter wants surfaced. */
  warnings?: string[];
  /** If the adapter fatally failed, a human-readable reason. */
  error?: string;
}

/** Adapter function signature — one of these per source platform. */
export type CinemaAdapter = (cinema: CinemaRow) => Promise<AdapterResult>;

// ── Utilities every adapter needs ────────────────────────────────────────────

/**
 * Infer format from a screen name.
 * e.g. "IMAX Laser" → IMAX, "3D Hall 2" → 3D, "VIP Suite 1" → VIP, else Standard.
 */
export function inferFormat(screenName?: string | null): string {
  if (!screenName) return 'Standard';
  const s = screenName.toUpperCase();
  if (s.includes('IMAX'))      return 'IMAX';
  if (s.includes('4DX'))       return '4DX';
  if (s.includes('3D'))        return '3D';
  if (s.includes('RECLINER'))  return 'Recliner';
  if (s.includes('VIP') || s.includes('LUXE') || s.includes('PREMIUM')) return 'VIP';
  return 'Standard';
}

/**
 * Convert an ISO UTC timestamp to { showDate, showTime } in Africa/Lagos (UTC+1, no DST).
 * We hand-roll the offset to avoid pulling in a TZ library.
 */
export function toLagosDateTime(iso: string): { showDate: string; showTime: string } {
  const d = new Date(iso);
  // Africa/Lagos is UTC+1 year-round (no DST)
  const lagosMs = d.getTime() + 60 * 60 * 1000;
  const l = new Date(lagosMs);
  const yyyy = l.getUTCFullYear();
  const mm = String(l.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(l.getUTCDate()).padStart(2, '0');
  const hh = String(l.getUTCHours()).padStart(2, '0');
  const mi = String(l.getUTCMinutes()).padStart(2, '0');
  const ss = String(l.getUTCSeconds()).padStart(2, '0');
  return { showDate: `${yyyy}-${mm}-${dd}`, showTime: `${hh}:${mi}:${ss}` };
}

/** Today's date in Africa/Lagos, as YYYY-MM-DD. */
export function todayLagos(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  // Africa/Lagos is UTC+1, so "today in Lagos" might already be tomorrow UTC after ~23:00 UTC.
  // Adding 1 hour before slicing gives us the Lagos calendar date.
  const lagos = new Date(d.getTime() + 60 * 60 * 1000);
  return lagos.toISOString().slice(0, 10);
}
