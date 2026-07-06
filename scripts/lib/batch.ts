// Batch runner for data-repair jobs (cleanup_*/backfill_*/fix_*/enrich_*).
// Handles pagination, batching, dry-run, outcome counting, and progress logging
// so a repair script is just a filter + a worker function. Usage:
//
//   import { supabase } from '../scripts/lib/db';
//   import { dryRun, fetchAll, runBatch } from '../scripts/lib/batch';
//
//   const rows = await fetchAll<{ id: string; title: string }>(
//     'films', 'id,title', (q) => q.is('slug', null)
//   );
//   await runBatch('backfill slugs', rows, async (film) => {
//     const slug = makeSlug(film.title);
//     if (dryRun) return `would set ${slug}`;
//     const { error } = await supabase.from('films').update({ slug }).eq('id', film.id);
//     if (error) throw error;
//     return 'updated';
//   });
//
// Run with --dry-run first, always.
import { supabase } from './db';

/** True when the script was invoked with --dry-run. Check it inside your worker. */
export const dryRun = process.argv.includes('--dry-run');

type QueryFilter = (q: any) => any;

/** Fetch every matching row, paging past the 1000-row PostgREST limit. */
export async function fetchAll<T = any>(
  table: string,
  select: string,
  applyFilter?: QueryFilter,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (applyFilter) q = applyFilter(q);
    const { data, error } = await q;
    if (error) throw new Error(`fetchAll(${table}): ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

export interface BatchOptions {
  /** Rows processed concurrently per batch (default 10). */
  batchSize?: number;
  /** Pause between batches in ms, to be gentle on the DB/API (default 100). */
  delayMs?: number;
  /** Stop after this many worker errors (default: never stop). */
  maxErrors?: number;
}

/**
 * Run `worker` over every row in concurrent batches. The worker returns a
 * short outcome label ('updated', 'skipped', ...) used for the final tally;
 * thrown errors are collected (with the row) without aborting the run.
 */
export async function runBatch<T>(
  name: string,
  rows: T[],
  worker: (row: T) => Promise<string | void>,
  opts: BatchOptions = {}
) {
  const { batchSize = 10, delayMs = 100, maxErrors = Infinity } = opts;
  const outcomes: Record<string, number> = {};
  const errors: { row: T; error: Error }[] = [];
  const started = Date.now();

  console.log(`${name}: ${rows.length} rows${dryRun ? ' [DRY RUN]' : ''}`);

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (row) => {
        try {
          const label = (await worker(row)) || 'done';
          outcomes[label] = (outcomes[label] || 0) + 1;
        } catch (e: any) {
          errors.push({ row, error: e });
        }
      })
    );
    const done = Math.min(i + batchSize, rows.length);
    if (done % 200 === 0 || done === rows.length) {
      console.log(`  ${done}/${rows.length} (${errors.length} errors)`);
    }
    if (errors.length >= maxErrors) {
      console.error(`  stopping: hit maxErrors (${maxErrors})`);
      break;
    }
    if (delayMs && i + batchSize < rows.length) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(
    `${name}: ${JSON.stringify(outcomes)} in ${((Date.now() - started) / 1000).toFixed(1)}s` +
      (errors.length ? `, ${errors.length} ERRORS` : '')
  );
  for (const { row, error } of errors.slice(0, 10)) {
    console.error(`  error: ${error.message} — row: ${JSON.stringify(row).slice(0, 200)}`);
  }
  if (errors.length > 10) console.error(`  ...and ${errors.length - 10} more errors`);

  return { outcomes, errors };
}
