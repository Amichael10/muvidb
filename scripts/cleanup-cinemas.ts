/**
 * Weekly cinema hygiene job. Run on its own (or it runs automatically at the end
 * of every showtimes sync). Expires past showtimes and demotes titles that have
 * stopped appearing in cinemas so the "In Cinemas Now" / "Leaving Cinemas Soon"
 * rails stay fresh instead of piling up old schedules.
 *
 *   npm run cleanup:cinemas            # default 14-day grace window
 *   npm run cleanup:cinemas -- 7       # custom grace window (days)
 */
import { sweepStaleCinemas } from '../api/_lib/cinema-adapters/index.js';

const graceDays = Number(process.argv[2]) || 14;

(async () => {
  console.log(`🧹 Sweeping stale cinemas (grace window: ${graceDays} days)...`);
  const result = await sweepStaleCinemas(graceDays);
  console.log(
    `✅ Done. Expired ${result.expired_showtimes} past showtimes, dropped ${result.dropped_films} stale films from cinemas.`,
  );
  process.exit(0);
})().catch((e) => {
  console.error('💀 Cinema cleanup failed:', e);
  process.exit(1);
});
