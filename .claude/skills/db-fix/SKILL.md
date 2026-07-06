---
name: db-fix
description: Bulk data repair in the database — cleanup, backfill, dedupe, enrich, or fix rows across a table. Use instead of writing a standalone cleanup_*/backfill_*/fix_* script from scratch.
---

# Bulk data repair

## Rule 1: no new standalone repair scripts in scripts/

The repo has ~30 abandoned `cleanup_*`/`backfill_*`/`fix_*`/`enrich_*` scripts
that each reimplement pagination, batching, and logging. Write repair jobs in
`scratch/` (gitignored) using the shared helpers, run them, delete them. Only
keep a script in `scripts/` if it will run on a schedule.

## Rule 2: always --dry-run first

Every repair script must be run with `--dry-run` first and its outcome tally
shown to the user before running for real. Destructive repairs (deletes,
merges) need explicit user confirmation between the dry run and the real run.

## The pattern

```ts
// scratch/fix_<thing>.ts
import { supabase } from '../scripts/lib/db';
import { dryRun, fetchAll, runBatch } from '../scripts/lib/batch';

const rows = await fetchAll<{ id: string; title: string }>(
  'films', 'id,title', (q) => q.is('slug', null)   // filter = same PostgREST builder API
);

await runBatch('backfill slugs', rows, async (film) => {
  const slug = makeSlug(film.title);
  if (dryRun) return `would-update`;               // label = counted in final tally
  const { error } = await supabase.from('films').update({ slug }).eq('id', film.id);
  if (error) throw error;                          // thrown errors are collected, not fatal
  return 'updated';
});
```

Run: `npx tsx scratch/fix_<thing>.ts --dry-run` then without the flag.

- `fetchAll` pages past the 1000-row PostgREST cap automatically.
- `runBatch` options: `{ batchSize, delayMs, maxErrors }`. Use `batchSize: 3,
  delayMs: 250` when each row triggers external API calls (TMDB, etc.).
- Return different labels ('updated', 'skipped', 'merged') to get a breakdown
  in the final tally.

## Dedupe/merge jobs

For people/film merges, check for an existing merge RPC first — grep
`supabase/migrations/` and root `merge_functions.sql` for `merge_`. Merging
via RPC keeps FK references consistent; hand-rolled deletes orphan credits.
