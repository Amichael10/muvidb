// Full cinema showtimes sync across ALL enabled cinemas + adapters
// (reach_cinema, veezi, bluepictures, firecrawl/local-stealth+Gemini).
// Runs in GitHub Actions; complements the dedicated Filmhouse API sync.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function main() {
  console.log('Starting full cinema showtimes sync (all adapters)…');
  try {
    // Dynamic import so .env is loaded BEFORE api/_lib/supabase.ts initialises.
    const { runShowtimesSync } = await import('../api/_lib/sync_service.js');
    const result = await runShowtimesSync();
    console.log('Done:', JSON.stringify(result, null, 2));
  } catch (err: any) {
    console.error('Showtimes sync failed:', err.message);
    process.exit(1);
  }
}

main();
