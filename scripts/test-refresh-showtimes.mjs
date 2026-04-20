/**
 * Local test harness — runs the reach_cinema adapter + upsert pipeline
 * against a single Viva cinema so we can verify end-to-end before wiring
 * it to the cron endpoint.
 *
 * Usage:   npx tsx scripts/test-refresh-showtimes.mjs [cinema-name-substr]
 * Default: Viva Ikeja (has showtimes today)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

// We import the adapter + upsert from the compiled TS source via tsx.
// Note: these files expect process.env.SUPABASE_URL, which .env provides.
const { reachCinemaAdapter } = await import('../api/_lib/cinema-adapters/reach-cinema.ts');
const { upsertShowtimes } = await import('../api/_lib/cinema-adapters/upsert.ts');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const nameSubstr = process.argv[2] || 'Ikeja';

const { data: cinemas } = await supabase
  .from('cinemas')
  .select('id, name, chain, city, booking_url, scrape_adapter, scrape_config, showtimes_last_fetched_at, scrape_failure_count')
  .ilike('name', `%${nameSubstr}%`)
  .eq('scrape_adapter', 'reach_cinema')
  .limit(1);

if (!cinemas?.length) {
  console.error(`No reach_cinema cinema matching "${nameSubstr}". Run seed-reach-cinema-cinemas.mjs first.`);
  process.exit(1);
}

const cinema = cinemas[0];
console.log(`\n▸ Testing: ${cinema.name} (${cinema.scrape_config?.externalCinemaId})\n`);

const t0 = Date.now();
const result = await reachCinemaAdapter(cinema);
const fetchedMs = Date.now() - t0;

if (result.error) {
  console.error(`✗ adapter error: ${result.error}`);
  process.exit(1);
}

console.log(`  Fetched ${result.showtimes.length} showtimes in ${fetchedMs}ms`);
if (result.showtimes.length) {
  console.log(`  Sample:`, JSON.stringify(result.showtimes[0], null, 2));
  const byFormat = result.showtimes.reduce((m, s) => ((m[s.format] = (m[s.format] || 0) + 1), m), {});
  console.log(`  Formats:`, byFormat);
  const dates = new Set(result.showtimes.map(s => s.showDate));
  console.log(`  Dates:`, [...dates].sort());
}

console.log(`\n▸ Upserting to Supabase (only Nollywood matches will land in showtimes)…`);
const t1 = Date.now();
const stats = await upsertShowtimes(cinema.id, result.showtimes, 'reach_cinema');
console.log(`  Done in ${Date.now() - t1}ms:`, stats);

// Show a couple pending_cinema_films entries so we can see the triage queue
const { data: pend } = await supabase
  .from('pending_cinema_films')
  .select('title, source, showtime_count, last_seen_at, admin_decision')
  .order('last_seen_at', { ascending: false })
  .limit(5);
if (pend?.length) {
  console.log(`\n▸ Top pending_cinema_films entries (admin triage queue):`);
  pend.forEach(p => console.log(`   • ${p.title}  [seen ${p.showtime_count}x, decision: ${p.admin_decision ?? '(pending)'}]`));
}
