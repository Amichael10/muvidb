---
name: db-migration
description: Make any database schema change (new table/column, RPC, RLS policy, trigger, index). Enforces the migrations workflow — use instead of writing loose .sql files.
---

# Database schema changes

## Rule 1: every schema change is a timestamped migration

Loose `.sql` files in the repo root or `sql/` do NOT get applied and get lost
(there are ~30 orphaned ones already, at least one security fix among them was
never run). All schema changes go in:

```
supabase/migrations/YYYYMMDDHHMMSS_short_description.sql
```

Use the current UTC timestamp. One logical change per migration.

## Workflow

1. **Write the migration file** in `supabase/migrations/`.
2. **Apply it** to the linked project:
   ```
   npx supabase db push
   ```
   If it complains about out-of-order migrations, review with
   `npx supabase migration list` before using `--include-all`.
3. **Regenerate types** (required whenever tables/columns/RPCs changed):
   - Bash: `npx supabase gen types typescript --linked > src/types/supabase.ts`
   - PowerShell (avoid plain `>`, it writes UTF-16):
     `npx supabase gen types typescript --linked | Out-File src/types/supabase.ts -Encoding utf8`
4. **Verify**: `npm run lint` (runs `tsc --noEmit`) to catch type breakage.

## Conventions

- Idempotent where possible: `create table if not exists`,
  `drop policy if exists ... ; create policy ...`, `create or replace function`.
- New tables need RLS enabled + policies in the same migration
  (`alter table x enable row level security;`). Default posture: public read
  for content tables, writes restricted to admin/service role.
- `security definer` functions must set `search_path = public`.
- Never edit an already-pushed migration; write a new one that alters it.
