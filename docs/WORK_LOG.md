# MuviDB — work log & pending backlog

**Purpose:** a running record of what has been done, what was deliberately *not*
done and why, and exactly where work stopped. Updated after each completed item so
any agent or developer can pick up without the originating conversation.

Companion doc: `docs/SSR_MIGRATION.md` (the SSR effort has its own detailed plan).

**Last updated:** 2026-07-24.

---

## Done

### ✅ Phase 0 — API function consolidation (merged, live)
12 → 7 Vercel functions to fit the Hobby free tier. `api/media.ts` absorbs
health + mirror-images via `?op=`; `api/data.ts` absorbs films/people/channels/
content via `?_r=`. Public URLs preserved by `vercel.json` rewrites, so no frontend
caller changed.

**Verified live by response body** (not status code — see the lesson below):
`/api/films?id=…`, `/api/people`, `/api/channels`, `/api/content`, `/api/health`,
`/api/mirror-images`, `/api/media?url=…`, `/sitemap*.xml`.

> **Late fix:** `/api/health` and `/api/mirror-images` returned `400 "Missing url"`
> for weeks after Phase 0 merged. The handlers and rewrites shipped, but the
> dispatch in `media.ts` that routes `?op=` to them was **never committed** — a
> `git add` that listed paths already removed by `git mv` fatal'd before staging
> anything, so only the renames landed. Fixed in `67204fc`.

### ✅ RLS security hardening (backlog item 5) — applied 2026-07-24
`supabase/migrations/20260724143045_security_rls_hardening.sql`, promoted from the
orphaned `sql/security_rls_hardening.sql` (loose files under `sql/` are **not** in
the migration pipeline, which is why this sat unapplied since the 2026-06-26 audit).

Several content tables had write policies *named* "admins can …" whose actual rule
was only `auth.uid() IS NOT NULL` — any logged-in user could insert/update/delete
films, people, credits, spotlights, top_10_films. Postgres OR's permissive policies,
so these also defeated the correct admin-only policies beside them.

Adds `public.is_admin()`, drops the loose policies, recreates admin-only
INSERT/UPDATE/DELETE, enforces the 5-minute review edit/delete window. Public SELECT
untouched. Service-role writes (cron, `api/_lib/supabase.ts`) bypass RLS, unaffected.

**Verified:** migration recorded remotely; `is_admin()` returns false for anon;
reads still open; anon writes return 0 rows; types regenerated; `tsc` clean.

> ✅ **Owner confirmed 2026-07-24:** admin login can still edit and save. The
> hardening did not break admin writes. (Anon-key testing could never prove this —
> the hole was for *logged-in* users, and anon never had access.)
>
> Several policies reported "does not exist, skipping": the real exposure was
> narrower than the audit file assumed. Treat that inventory as approximate.

### ✅ Backlog item 7 — 57014 perf workarounds: INVESTIGATED, deliberately NOT removed
The note said to strip the 57014 retries/deferrals in `Home.jsx` and
`WatchPlatform.jsx` once the new indexes were confirmed in prod (~after 2026-07-03).

**Measured against production 2026-07-24 — the premise does not hold. Keep them.**

Seven platform count queries run back-to-back:

| platform | result |
|---|---|
| netflix | **FAIL** (4046ms) |
| prime_video | **FAIL** (3607ms) |
| kava / docuth / ebonylife / circuits / youtube | ok, 631–1118ms |

Run individually the same netflix query succeeds (`count=222`, ~700ms). So the
failures are **transient and load/cold-start dependent**, which is precisely what
the retries absorb. The same failures appear in the live app's browser console
(`Error counting platform netflix …`).

Two things to know if this is revisited:
- The observed failures carried **`code === undefined`, not `57014`**, so the
  existing retry (which only fires on 57014) does *not* catch them. Widening that
  condition would help more than deleting it.
- Removing the retries would silently collapse real counts to null and hide the two
  biggest platforms on the homepage rail.

---

### ✅ Backlog item 6 — cinema dedupe: NO ACTION NEEDED (surveyed 2026-07-24)
The note claimed a destructive merge was "staged and dry-run verified". **That
tooling does not exist in the repo** — the note was stale. `scripts/cleanup-cinemas.ts`
is the weekly hygiene job (expires showtimes, demotes stale films) and
`sql/cinema_cleanup.sql` only *disables scraping*; neither merges rows.

Read-only survey of production:
- **183 cinemas, 0 exact duplicates** (by normalised name, and by name+city).
- `sql/cinema_cleanup.sql` **was** applied: 0 `custom`-adapter rows still enabled,
  0 token-less `veezi` rows still enabled.
- 16 near-duplicate pairs (one name a prefix of another), but these are
  parent/branch pairs where the generic row is **already disabled** — e.g.
  "Viva Cinemas" (off) alongside its six city branches (on), "…Jabi Lake Mall"
  (off) alongside "…Jabi Lake" (on). That is the intended end state.
- 59 of 183 cinemas have `scrape_enabled = true`.

**✅ Owner ruled 2026-07-24: these are DIFFERENT BRANCHES — do not delete or merge.**
The 5 both-enabled pairs below are legitimately separate cinemas, so both rows
scraping is correct, not double-counting. **This item is closed; do not reopen it
as a "duplicate cinemas" task.**

| | |
|---|---|
| "KADA Cinemas" | "Kada Cinemas Benin" |
| "Nile Cinemas" | "Nile Cinemas Vintano" |
| "Nile Cinemas" | "Nile Cinemas THC" |
| "Box Office Cinemas" | "Box Office Cinemas Pleasure Park" |
| "Nova Cinema" | "Nova Cinema Abuja" |

### ✅ Person-name matching — fuzzy suggestions added 2026-07-24
Reported as "the name swap doesn't recognise CAPITAL LETTERS or close names like
Bayo Adeniyi vs Adebayo Adeniyi". **Both halves of that were partly wrong — measured
against production before changing anything:**

- **Case was never broken.** `find_person_by_name` already returns the same id for
  `Adebayo Adeniyi`, `ADEBAYO ADENIYI`, `adebayo adeniyi`, and the order swap
  (`Adeniyi Adebayo`) already resolved correctly. What looked like a matching
  failure is that the record is **stored** as `ADEBAYO ADENIYI` in all caps.
  → **Separate open task: normalise shouty stored names.** Matching is fine.
- **`Bayo Adeniyi` → `Adebayo Adeniyi` already worked — but only by accident**,
  because `%bayo%` is a substring of `ADEBAYO`. Non-substring variants
  (`Shola`/`Sola`) found nothing. That was the real gap.

**Added** `supabase/migrations/20260724170000_suggest_similar_people.sql`:
`suggest_similar_people(p_name, p_limit)` — pg_trgm similarity, plus an exact
`name_key` (order-insensitive) match scored `1.0` as a certainty rather than a
guess. It **never links or merges**; `find_person_by_name` stays strict so two
different people are never silently merged.

Verified live: `Bayo Adeniyi` → `Adeniyi Bayo` (1.00), `ADEBAYO ADENIYI` (0.73),
`Bayo Adeniran` (0.59). Caps make no difference to results.

Wired into `src/lib/peopleSearch.js`: new `suggestSimilarPeople()` export, and
`searchPeopleByName` falls back to it **only when nothing matched**, so ranked
results are never diluted by guesses and a missing RPC can't break a search box.

> **Gotcha:** `pg_trgm` lives in Supabase's `extensions` schema, not `public`. An
> unqualified `gin_trgm_ops` fails with "operator class does not exist for access
> method gin"; the function also needs `extensions` on its `search_path` for
> `similarity()` and `%`. First push failed on exactly this.

**Still to do:** the credit-extractor / admin create-person flows don't call
`suggestSimilarPeople()` yet — that is where it would prevent duplicates *at
source*, rather than only helping someone who is already searching.

**Live duplicate found, left for the owner:** `Adeniyi Bayo` (1 film) and
`ADEBAYO ADENIYI` (8 films) are separate records and plausibly the same person.
Not merged — that is a judgement call.

---

## Pending

Ordered by my recommendation.

### 1. SSR migration — parked on branch `ssr-phase-1` (now `6beac43`)

**IN PROGRESS — experiment awaiting a preview-deploy result.**

Before rewriting seven endpoints on an unverified diagnosis, `6beac43` tests the
cheaper hypothesis. Two mechanisms could explain why every `/api/*` route returned
the SSR shell in production, and they have very different fixes:

- **(a)** Vercel never builds `api/` once a framework owns the Build Output API
  output → declaring the functions explicitly fixes it (one config line).
- **(b)** The functions build but are shadowed by the SSR catch-all → routing fix,
  or convert all seven endpoints to React Router **resource routes** (large).

`6beac43` adds `"functions": { "api/**/*.ts": { "maxDuration": 60 } }` to test (a).

**RESULT — the build failed, and the error is definitive:**

```
Error: The pattern "api/**/*.ts" defined in `functions` doesn't match any
Serverless Functions inside the `api` directory.
```

**Vercel sees ZERO functions in `api/` when `framework: react-router` is set.** The
framework build owns `.vercel/output` via the Build Output API, which switches off
`api/` auto-detection entirely. Declaring them cannot force it back on. So
`api/*.ts` and framework-mode SSR genuinely cannot coexist — now *verified*, not
assumed. Experiment reverted in `26b72a3`; the branch builds again.

### → The fix: invert it. Don't let the framework own the output.

Rather than converting seven endpoints to resource routes (large, risky, and it
buries a 60s cron and an image proxy inside the SSR function), keep every existing
`api/*.ts` function untouched and add **one more function that serves the SSR app**:

1. **Remove** `framework: react-router` from `vercel.json` so Vercel's normal `api/`
   detection stays on and the seven functions build as they do today.
2. Keep building with `react-router build` → `build/client` + `build/server`.
3. Add `api/ssr.ts`:
   ```ts
   import { createRequestHandler } from '@react-router/node';
   import * as build from '../build/server/index.js';
   const handler = createRequestHandler(build, 'production');
   export default (request: Request) => handler(request);
   ```
   Vercel Node functions accept the Web-standard `(Request) => Response` signature,
   which is exactly what React Router's handler is.
4. `vercel.json`: serve static assets from `build/client`, route everything else to
   `/api/ssr`, and add `includeFiles` so `build/server` is bundled into that function.
5. Drop `@vercel/react-router` and the `vercelPreset()` from `react-router.config.ts` —
   the preset is what triggers the Build Output takeover.

**Function count: 7 + 1 = 8**, inside the Hobby limit of ~12 — which is precisely
what Phase 0's consolidation bought. (Phase 0 was justified after all, just not for
the reason originally recorded.)

**Unverified, must be checked on a preview before merging:** whether `includeFiles`
correctly bundles the server build, and whether static assets resolve from
`build/client`. Verify by **content-type**, never status code — the SSR shell
returns 200, which is what hid the original breakage.

---

Prior state of this item (still accurate):
Code-complete through Phase 3 (Home hero, Browse, Search, FilmDetail, PersonDetail
+ the six detail routes' SEO). **Cannot merge as-is.**

**Blocker:** `api/*.ts` serverless functions and a framework-mode SSR build do not
coexist — a first merge to production made *every* `/api/*` route and `/sitemap.xml`
return the SSR shell, breaking the film page, image proxy and sitemaps. Reverted in
`5a38d92`. The fix is to convert the seven endpoints to React Router **resource
routes**, which also dissolves the Hobby function-count limit that motivated Phase 0.

Remaining Phase 3 pages: PeopleList, Channels, Companies, Cinemas, Showtimes,
TVShows. Open decision: thin/missing entities now return 200 + `noindex` where
`api/seo.ts` returned 404. Details in `docs/SSR_MIGRATION.md`.

### Data-quality queue
- **Curation:** ~4,192 "farm-but-engaged" films to clean.
- **Ratings:** existing comment-mined films need re-mining under the stricter rubric.
- **Languages:** ~82% of films still default to English; detection pass part-done.
- **People dedupe:** ~567 medium-confidence groups remain.

### Housekeeping
- `supabase/migrations/20260724120000_films_imdb_rating.sql` is **applied to
  production but untracked in git** — schema drift risk if lost. Owner's file;
  worth committing along with `api/_lib/rating.ts` and the `scrape:imdb-from-db`
  script in `package.json`.
- A stale **PWA service worker** from the SSR build can serve dead precached assets
  and make the app look broken (seen on localhost). Fix: unregister the SW + clear
  site data + hard reload. May also affect users who loaded the site during the
  broken SSR deploy.
- npm's cache points at `D:\npm-cache` and `D:` does not exist, so every
  `npm install` fails with a misleading `ENOENT … mkdir '\\?'`. Work around with
  `npm install --cache <writable-dir>`.

---

## Lessons that cost real time

1. **Verify deploys by response body, not status code.** The SSR deploy returned
   `200` on every `/api/*` route while serving the SSR shell. Status codes said
   healthy; content-type said the entire API layer was down.
2. **Verify the *staged* diff, not the working tree.** `git add` with a pathspec
   that no longer exists fatals before staging anything, and a local build still
   passes because it reads the working tree. This shipped a broken commit once and
   a silently half-applied Phase 0 for weeks.
3. **A loading flag that starts `true` defeats SSR.** Components gated on it
   server-render a skeleton. Hit three times (AuthContext, `isHeroLoading`,
   Browse's `loading`).
4. **Don't assume a dirty file is someone else's work** — check `git diff` on it.
   `api/media.ts` sat uncommitted for a whole session because it was misread as
   unrelated local WIP.
