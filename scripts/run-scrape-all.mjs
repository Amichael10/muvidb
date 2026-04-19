/**
 * Runs the scrape pipeline across every scrape-enabled cinema.
 * Equivalent to what /api/cron/refresh-showtimes does — useful for local runs
 * before the cron fires, or to backfill new cinemas on demand.
 *
 * Usage: npx tsx scripts/run-scrape-all.mjs
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const { ADAPTERS } = await import('../api/_lib/cinema-adapters/index.ts');
const { upsertShowtimes } = await import('../api/_lib/cinema-adapters/upsert.ts');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: cinemas } = await supabase
  .from('cinemas')
  .select('id, name, chain, city, booking_url, scrape_adapter, scrape_config, showtimes_last_fetched_at, scrape_failure_count')
  .eq('scrape_enabled', true)
  .order('name');

if (!cinemas?.length) {
  console.log('No cinemas enabled for scraping. Run seed-reach-cinema-cinemas.mjs first.');
  process.exit(0);
}

console.log(`Running scrape for ${cinemas.length} cinemas…\n`);

let totalShowtimes = 0, totalUnmatched = 0, failed = 0;

for (const c of cinemas) {
  const adapter = ADAPTERS[c.scrape_adapter];
  if (!adapter) {
    console.log(`  ✗ ${c.name} — no adapter '${c.scrape_adapter}'`);
    failed++; continue;
  }
  const t0 = Date.now();
  try {
    const res = await adapter(c);
    if (res.error) throw new Error(res.error);

    const stats = await upsertShowtimes(c.id, res.showtimes, c.scrape_adapter);
    totalShowtimes += stats.matched_showtimes;
    totalUnmatched += stats.unmatched_titles;

    await supabase
      .from('cinemas')
      .update({
        showtimes_last_fetched_at: new Date().toISOString(),
        scrape_failure_count: 0,
        scrape_last_error: null,
      })
      .eq('id', c.id);

    console.log(`  ✓ ${c.name.padEnd(32)}  →  ${res.showtimes.length} raw · ${stats.matched_showtimes} Nollywood · ${stats.unmatched_titles} pending  (${Date.now() - t0}ms)`);
  } catch (err) {
    failed++;
    console.log(`  ✗ ${c.name.padEnd(32)}  →  ERROR: ${err.message}`);
    await supabase
      .from('cinemas')
      .update({
        scrape_failure_count: (c.scrape_failure_count ?? 0) + 1,
        scrape_last_error: err.message.slice(0, 500),
      })
      .eq('id', c.id);
  }
}

console.log(`\n✅ Done. ${totalShowtimes} showtimes written · ${totalUnmatched} unmatched titles · ${failed} failed.`);
