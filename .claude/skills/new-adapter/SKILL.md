---
name: new-adapter
description: Build a sync/scraper adapter for a new content source (streaming platform, cinema chain, YouTube channel, film database) that writes into the films/showtimes/people tables.
---

# New source adapter

Prereq: recon is done (see the scraper-recon skill) and a parser was proven in
`scratch/`. An adapter is the graduation of that prototype.

## Skeleton

Create `scripts/<source>_sync.ts`:

```ts
import { supabase } from './lib/db';
import { startSyncLog } from './lib/sync';

async function main() {
  const log = await startSyncLog('<source>', 'Syncing <source>...');
  try {
    const items = await fetchCatalog();          // your proven fetch + parse

    for (const item of items) {
      log.counters.processed++;
      // match-or-create, upsert (see conventions below)
      log.counters.updated++;                    // or .failed++ on row error
    }

    await log.finish(`<source> sync complete. ${log.counters.updated} updated.`);
  } catch (err: any) {
    console.error(err);
    await log.fail(err);
    process.exit(1);
  }
}

main();
```

`startSyncLog` handles the whole `sync_logs` lifecycle (running → success/
partial/error, duration, item counts) — never write to `sync_logs` by hand.

Then register it in `package.json`: `"sync:<source>": "tsx scripts/<source>_sync.ts"`.

## Conventions (follow the working adapters)

Reference implementations: `scripts/sync-filmhouse.ts` (cinema showtimes via
hidden API), `scripts/sync_feed_kappa.ts` (streaming catalog).

- **Film matching cascade** — never blind-insert films. Order:
  1. `films` by `ilike('title', cleaned)` (+ `is_nollywood` when relevant)
  2. `pending_cinema_films` with `admin_decision = 'promoted'` → use `promoted_film_id`
  3. TMDB lookup via `findAndInsertMissingFilm` (`scripts/lib/tmdb_cinema.ts`)
  4. Fall back to inserting/incrementing a `pending_cinema_films` triage row
- **Clean titles** with `cleanTitle` from `api/_lib/yt_service.js` before matching.
- **Showtimes**: delete-then-insert per `(cinema_id, show_date, source)`,
  dedupe rows on `film_id_cinema_id_show_date_show_time` before insert, set
  `source` and `last_seen_at`, and call `sweepStaleCinemas()`
  (`api/_lib/cinema-adapters/index.js`) at the end.
- **Tag provenance**: every inserted row gets a `source` value unique to this
  adapter so its data can be identified and re-synced/purged.
- **Rate-limit** external calls (small batches + delays); scrapers run
  unattended via the automation jobs, so failures should be logged, not thrown
  away.

## Scheduling

If the source should sync automatically, register it in the automation jobs
table (see `create_automation_jobs.sql` and `scripts/automation_daemon.ts`)
after the manual `npm run sync:<source>` run is verified.
