import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function run() {
  const { createClient } = await import('@supabase/supabase-js');
  const { ADAPTERS } = await import('../api/_lib/cinema-adapters/index.js');
  const { upsertShowtimes } = await import('../api/_lib/cinema-adapters/upsert.js');

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  );

  const { data: enabledCinemas } = await supabase
    .from('cinemas')
    .select('id, name, chain, city, booking_url, scrape_adapter, scrape_config, showtimes_last_fetched_at, scrape_failure_count')
    .eq('scrape_enabled', true)
    .order('name');

  const requestedCinemas = process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--cinema='))
    .map((arg) => arg.slice('--cinema='.length).trim().toLowerCase())
    .filter(Boolean);
  const cinemas = requestedCinemas.length
    ? (enabledCinemas || []).filter((cinema) =>
        requestedCinemas.includes(cinema.id.toLowerCase())
        || requestedCinemas.includes(cinema.name.toLowerCase()))
    : enabledCinemas;

  if (!cinemas?.length) {
    console.log('No cinemas enabled for scraping.');
    process.exit(0);
  }

  console.log(`Running scrape for ${cinemas.length} cinemas…\n`);

  let totalShowtimes = 0, totalUnmatched = 0, failed = 0;

  for (const c of cinemas) {
    const adapter = (ADAPTERS as any)[c.scrape_adapter];
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
    } catch (err: any) {
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
}

run();
