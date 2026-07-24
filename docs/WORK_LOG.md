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

> ⚠️ **Still needs a human check.** The hole was for *logged-in* users, and anon
> never had access — so anon-key testing proves nothing about the actual fix.
> Log in as an admin and confirm you can still create/edit/delete a film, and that
> a normal (non-admin) logged-in account cannot. If admin writes break, look at
> `is_admin()` — it reads `public.users.role`.
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

## Pending

Ordered by my recommendation.

### 6. Cinema dedupe — **destructive, awaiting explicit go-ahead**
Merge of duplicate cinema rows; previously staged and dry-run verified. Needs the
dry-run re-run and the affected row count confirmed before anything is deleted.
**Do not execute without the owner confirming the numbers.**

### 1. SSR migration — parked on branch `ssr-phase-1` (`6b03941`)
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
