/**
 * POST /api/cron/refresh-showtimes
 *
 * Called by Supabase pg_cron 1× per day (6am UTC = 7am WAT).
 * Also callable manually from /admin/cinema-scraping → "↻ Sync now" button.
 *
 * For each cinema with scrape_enabled=true and stale showtimes_last_fetched_at:
 *   1. Dispatch to the matching adapter (reach_cinema / veezi / cinesync / ...)
 *   2. Feed the scraped showtimes through upsertShowtimes():
 *      - Match/create films (fuzzy match by title, auto-create w/ needs_review if new)
 *      - Upsert showtime rows on (cinema_id, film_id, show_date, show_time, format)
 *      - Mark any existing showtimes not in the batch as is_available=false
 *   3. Stamp showtimes_last_fetched_at on the cinema
 *
 * Auth: x-cron-secret header must equal CRON_SECRET env var.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { ADAPTERS, upsertShowtimes, type CinemaRow } from '../_lib/cinema-adapters';

export const config = { maxDuration: 60 };

const CRON_SECRET       = process.env.CRON_SECRET;
const CINEMAS_PER_RUN   = 15;       // stay under Vercel 60s timeout
const STALENESS_HOURS   = 10;       // skip cinemas refreshed more recently
const MAX_FAILURES      = 5;        // after this many consecutive failures, skip until admin re-enables

interface CinemaSummary {
  id: string;
  name: string;
  adapter: string | null;
  matched_showtimes: number;
  unmatched_titles: number;
  marked_unavailable: number;
  ms: number;
  error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // Auth — support both x-cron-secret and native Vercel Authorization header
  const authHeader = req.headers['authorization'];
  const cronSecretHeader = req.headers['x-cron-secret'];
  const isValidAuth = (CRON_SECRET && (cronSecretHeader === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`));

  if (CRON_SECRET && !isValidAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - STALENESS_HOURS * 60 * 60 * 1000).toISOString();

  // Pick cinemas that are enabled, not in the failure penalty box, and stale (or never fetched)
  const { data: cinemas, error: selErr } = await supabase
    .from('cinemas')
    .select('id, name, chain, city, booking_url, scrape_adapter, scrape_config, showtimes_last_fetched_at, scrape_failure_count')
    .eq('scrape_enabled', true)
    .lt('scrape_failure_count', MAX_FAILURES)
    .or(`showtimes_last_fetched_at.is.null,showtimes_last_fetched_at.lt.${cutoff}`)
    .order('showtimes_last_fetched_at', { ascending: true, nullsFirst: true })
    .limit(CINEMAS_PER_RUN);

  if (selErr) {
    return res.status(500).json({ error: 'Failed to fetch cinemas', detail: selErr.message });
  }

  const results: CinemaSummary[] = [];

  for (const cinema of (cinemas ?? []) as CinemaRow[]) {
    const startedCinema = Date.now();
    const adapterName = cinema.scrape_adapter;
    const summary: CinemaSummary = {
      id: cinema.id,
      name: cinema.name,
      adapter: adapterName,
      matched_showtimes: 0,
      unmatched_titles: 0,
      marked_unavailable: 0,
      ms: 0,
    };

    if (!adapterName || !ADAPTERS[adapterName]) {
      summary.error = `unknown or missing adapter: ${adapterName ?? '(null)'}`;
      results.push(summary);
      continue;
    }

    try {
      const result = await ADAPTERS[adapterName](cinema);
      if (result.error) throw new Error(result.error);

      const stats = await upsertShowtimes(cinema.id, result.showtimes, adapterName);
      summary.matched_showtimes  = stats.matched_showtimes;
      summary.unmatched_titles   = stats.unmatched_titles;
      summary.marked_unavailable = stats.marked_unavailable;

      // Success — stamp last fetched + reset failure count
      await supabase
        .from('cinemas')
        .update({
          showtimes_last_fetched_at: new Date().toISOString(),
          scrape_failure_count: 0,
          scrape_last_error: null,
        })
        .eq('id', cinema.id);
    } catch (err: any) {
      summary.error = err.message || String(err);
      console.error(`[refresh-showtimes] ${cinema.name}:`, summary.error);
      // Bump failure count; after MAX_FAILURES the cinema is skipped until admin resets it
      await supabase
        .from('cinemas')
        .update({
          scrape_failure_count: (cinema.scrape_failure_count ?? 0) + 1,
          scrape_last_error: summary.error.slice(0, 500),
        })
        .eq('id', cinema.id);
    } finally {
      summary.ms = Date.now() - startedCinema;
      results.push(summary);
    }
  }

  const totalMs = Date.now() - startedAt;
  const ok = results.filter(r => !r.error).length;
  const failed = results.length - ok;

  return res.status(200).json({
    ok: true,
    total_ms: totalMs,
    cinemas_processed: results.length,
    successes: ok,
    failures: failed,
    total_showtimes_written: results.reduce((n, r) => n + r.matched_showtimes, 0),
    total_unmatched_titles:  results.reduce((n, r) => n + r.unmatched_titles, 0),
    results,
  });
}
