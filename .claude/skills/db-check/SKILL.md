---
name: db-check
description: Inspect or query the Supabase database (check rows, counts, schemas, debug data issues). Use whenever tempted to write a one-off check_*/inspect_*/find_*/debug_* script — this replaces that pattern.
---

# Database inspection

## Rule 1: never create new one-off scripts in the repo

The repo already has 80+ abandoned `check_*`, `inspect_*`, `find_*`, `debug_*` scripts.
Do not add more — not in the repo root, not in `scripts/`.

## Simple queries: use the query runner

```
npm run db -- <table> [--select cols] [--where col=op.value]... [--order col.desc] [--limit n] [--count]
```

Examples:

```
npm run db -- films --select id,title,year --order created_at.desc --limit 10
npm run db -- films --where year=eq.2024 --where country=eq.NG --count
npm run db -- people --where name=ilike.*adesua* --select id,name,slug
npm run db -- films --select "id,title,credits(person_id,role)" --limit 5
```

`--where` takes PostgREST filter syntax (`eq.`, `neq.`, `gt.`, `ilike.`, `in.(a,b)`,
`is.null`, `not.is.null`). `--select` supports embedded resources for joins.

## Complex one-offs: write to scratch/, import the shared client

If the runner can't express it (multi-step logic, writes, RPC calls), write a
throwaway script in `scratch/` (gitignored) and delete it when done:

```ts
// scratch/check_thing.ts
import { supabase } from '../scripts/lib/db';
// ... your logic
```

Run with `npx tsx scratch/check_thing.ts`.

Never re-create a Supabase client manually — `scripts/lib/db.ts` handles env
loading (`.env.local` then `.env`), IPv4 DNS ordering, and the service-role key.

## Schema questions

Check `src/types/supabase.ts` (generated types for every table/column) before
querying the DB to discover a schema. For RLS/policies/triggers, check
`supabase/migrations/`.
