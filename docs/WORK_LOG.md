# MuviDB — work log & pending backlog

**Purpose:** a running record of what has been done, what was deliberately *not*
done and why, and exactly where work stopped. Updated after each completed item so
any agent or developer can pick up without the originating conversation.

Companion doc: `docs/SSR_MIGRATION.md` (the SSR effort has its own detailed plan).

**Last updated:** 2026-07-28.

---

## ⏳ IN PROGRESS — YouTube credit-roll harvester (2026-07-28) — LOCAL ONLY, not committed

**Problem:** Nollywood YouTube films aren't on IMDB. Measured the alternatives:
descriptions are hashtag spam (**0%** carry cast markers — the "Starring:" theory was
tested and is false); the **actor is often in the TITLE** ("JACINTA THE WISE FOOL PT 1
— Ekene Umenwa"). The credit roll remains the only full cast/crew source. Manual
screenshot+OCR hits 99% **because a human picks the frame** — so the automation's real
failure is *frame selection and validation*, not the AI.

**Design (see the reasoning in this session):** ffmpeg finds the roll, **local OCR
(tesseract) reads it — zero image tokens**, only the video *tail* is downloaded at low
res. Runs headless on a spare laptop (residential IP + flat bandwidth; cloud+residential
proxy would cost thousands, since proxies bill per GB and video is heavy).

**Built:**
- `supabase/migrations/20260728010500_credit_harvest.sql` — **applied**.
  `credit_harvest_jobs` (work queue) + `credit_candidates` (proposals awaiting review).
  Admin-only RLS **and** table GRANTs (the `film_related` 42501 lesson).
  `outcome='no_credits'` is a **first-class result**, so films with no roll are recorded
  and never re-guessed.
- `scripts/harvest_credits.ts` — headless worker. Enqueue modes (`--enqueue-recon`,
  `--enqueue-popular`), claim loop, resumable, rate-limited.
  **Fixes the two reported failures:** `STOP_MARKERS` discard promo blocks wholesale
  ("coming soon", "subscribe", "watch part 2") so end-of-video adverts are never mined
  for names; a **structural density gate** (`MIN_ENTRIES`) rejects frames that aren't a
  real roll instead of harvesting stray names. Names resolve via
  `find_person_by_name` / `upsert_person_by_name` so it can't spawn duplicate people.
- `src/pages/admin/AdminCreditHarvest.jsx` + route `/admin/credits/harvest` + nav link.
  Pipeline stats, grouped-by-film review, **approve / reject / delete** (per-row and
  bulk), confidence filter. Approve creates the person if needed then writes the credit;
  reject keeps the row so the same bad name isn't re-proposed; delete removes OCR junk.

**Verified:** migration applied; table read/write; `--enqueue-recon=1` really enqueued
**991 jobs across 992 channels** (those rows are live in the queue now); the admin
page's exact embedded query returns correctly-shaped data; `npm run build` passes.

**NOT verified — the extraction loop has never actually run.** `yt-dlp`, `ffmpeg` and
`tesseract` are not installed on this machine, so download → frame-extract → OCR → parse
is unproven end to end. Expect the OCR parsing heuristics (`looksLikeName`, role
splitting, `STOP_MARKERS`) to need tuning against real Nollywood rolls — that's the part
to iterate on first.

**To start on the worker laptop:** install the three tools, then
`npx tsx scripts/harvest_credits.ts --enqueue-recon=3` and
`npx tsx scripts/harvest_credits.ts`. **Disable sleep first** — that's the usual reason
these jobs are found dead days later. Debug a single film with `--film=<uuid> --keep`.

---

## ⏳ IN PROGRESS — "More Like This" recommender + film-edit language dropdown (2026-07-28)

**Status: built + DB migrations applied, but LOCAL ONLY — NOT committed, NOT pushed**
(owner's standing rule this session: experiments on staging, no push without the
word). Built in the working tree alongside the owner's own uncommitted WIP, which
was left untouched — my target files (`AdminFilms.jsx`, `FilmDetail.jsx`) weren't in
their dirty set.

**Recommender — precomputed `film_related` table (the "best option").** Replaces the
old genre-only related query that degraded to random (62%→actually 97% of films are
"Drama", and its empty-genre fallback pulled 12 arbitrary rows).
- **Migrations applied to the shared DB** (additive, safe, nothing read it until the
  frontend wire): `20260728002546_film_related.sql` (table + RLS public-read),
  `20260728002727_film_related_grants.sql`. NB the table shipped with no GRANTs, so
  even service_role hit 42501 until granted — RLS narrows, GRANT enables.
- `scripts/build_related_films.ts` — weighted blend, computed offline:
  **shared cast/crew** (strongest; label "More with <name>") > **rarity-weighted
  genre** (IDF; **Drama on 97% of films is excluded entirely — the key lever**) >
  **shared minority language** (bonus only when non-English) > **same series** >
  year proximity, **popularity as a non-random fallback** (never arbitrary rows).
- De-dup guards that proved necessary: drops re-uploads of the SAME film under
  variant titles ("Cwa (Calamity Wanders Ahead)" vs "Calamity Wanders Ahead"), and
  caps each franchise to 2 via a `franchiseKey` that strips part/season/episode
  numbers (naive first-N-words fails: "Koleoso Pt 13" vs "Koleoso Part 7").
- **Populated 467,875 rows across ~39k films.** Verified on cast-rich films
  (Koleoso → other Ibrahim Yekini/Itele films; Calamity → varied cast) and confirmed
  the exact anon embedded query the browser runs returns relevant, labelled results.
- `FilmDetail.jsx` reads `film_related` first (one indexed query), falls back to the
  old live genre logic only when a film has no precomputed rows. A brand-orange
  reason label renders under each related title.
- **Freshness TODO:** `film_related` is a snapshot — new films/credits won't show as
  related until a rebuild. Schedule `npx tsx scripts/build_related_films.ts` (weekly,
  or after the daily sync). Re-running is safe (delete-then-insert per film).

**Film-edit language dropdown.** `AFRICAN_LANGUAGES` (curated, Nigeria-first) added to
`src/utils/languages.js`; `AdminFilms.jsx` edit form gets a chip multi-select in the
Duration/Rating row, backed by the existing `formData.language` string (first =
primary). Existing save path already parses it to `languages[]` — no save change.

**Caveats:** neither feature is visually tested (dev server had a stale-service-worker
issue earlier). `tsc`/build pass; the two chunking warnings are pre-existing. Nothing
committed or pushed — awaiting the owner's call on landing to staging.

---

### Homepage perf pass 1 (2026-07-25, live `e8de7fd`)

**Where we stopped:** Homepage perf pass 1 is on production. Lab re-score
(mobile, 2-run avg) vs baseline:

| | Before | After |
|---|---:|---:|
| Perf | 27 | **36** |
| LCP | 18.9s | **10.8s** |
| TBT | 27.2s | **5.8s** |
| DOM | 3481 | **1381** |
| FCP | 4.2s | **3.0s** |

(Run variance still high — warm run hit Perf 43 / LCP 4.8s.) More home work
possible; next planned lanes: **data-quality**, then **housekeeping**. Do **not**
set Vercel Framework Preset to “React Router”.

---

## Done

### ✅ Invert-SSR packaging — LIVE on production (2026-07-24)

**Branches / tip:** `ssr-once-and-for-all` → `staging` → `main` @ `aac5051`.
Companion detail: `docs/SSR_MIGRATION.md`, `docs/SSR_SCALE.md`.

#### What blocked SSR (the real outage)

A first attempt used Vercel’s **framework mode** (`framework: "react-router"` /
`vercelPreset()`). That made the React Router build own `.vercel/output` via the
Build Output API and **switched off `api/` auto-detection entirely**.

Symptoms in production:
- Every `/api/*` and `/sitemap.xml` returned **HTTP 200** with the **SSR HTML shell**
  (not JSON / XML) → film page, image proxy, sitemaps all looked “up” by status code
  but were dead by content-type.
- Experiment `6beac43` tried declaring `"functions": { "api/**/*.ts": … }` under
  framework mode. Build failed with:
  `The pattern "api/**/*.ts" … doesn't match any Serverless Functions inside the api directory`
  → Vercel saw **zero** `api/` functions. Proof that declaring them cannot force
  auto-detection back on. Reverted in `26b72a3`.
- Site was rolled back to classic Vite SPA (`bbf44d4` / `4ca629d`) so `muvidb.com`
  worked again while packaging was fixed on a preview branch.

**Do not “fix” this by converting all seven APIs into RR resource routes** unless
Hobby limits force it — that was the old plan; invert packaging is the chosen fix.

#### How we fixed it (invert packaging)

Keep every existing `api/*.ts` function. Add one more function that serves the app:

| Piece | Role |
|---|---|
| `vercel.json` `"framework": null` | Restores normal `api/` detection |
| `npm run build` → `react-router build` | Emits `build/client` + `build/server` |
| `outputDirectory`: `build/client` | Static assets |
| Catch-all rewrite → `/api/ssr?__pathname=/$1` | HTML documents |
| `api/ssr.ts` | Node `(VercelRequest, VercelResponse)` adapter |
| `api/_lib/rrHandler.ts` | Lazy-imports `build/server`, `createRequestHandler` from **`react-router`** (not `@react-router/node`) |
| `api/seo.ts` | **Sitemaps only**; document SEO via route loaders / `seo.server.ts` |
| `react-router.config.ts` | **No** `vercelPreset()` / `@vercel/react-router` |
| `vite.config.ts` | Must use `reactRouter()` from `@react-router/dev/vite` — **not** `@vitejs/plugin-react` alone |

Function count: previous 7 + `api/ssr` ≈ 8 (inside Hobby). Phase 0 consolidation
is what made room for this.

#### Landmines hit while shipping (and the commits)

1. **Web Fetch-only `api/ssr` export** → `FUNCTION_INVOCATION_FAILED` on Vercel.
   Fix: Node adapter wrapping the RR handler (`ef5f145` / follow-ups).
2. **Static import of RR build at module top** → empty/missing build at cold start.
   Fix: lazy-import in `rrHandler` + clear missing-build errors (`2edc213`).
3. **`supabase.server.ts` baked empty `SUPABASE_URL` at Vite build** → loaders failed.
   Fix: lazy server client creation.
4. **Staging merge kept SPA `vite.config.ts`** (no `reactRouter()` plugin) →
   `React Router Vite plugin not found in Vite config`. Fix: restore SSR vite
   config (`f95cd26`). Always prefer SSR tip for `vite.config.ts` /
   `vercel.json` / `api/ssr.ts` / `package.json` scripts on merge.
5. **Actor photos on cards but not PersonDetail** — cards used raw `photo_url`;
   detail used `ImageWithFallback` → `getProxiedImageUrl` nested `/api/media`
   inside `/_vercel/image` → `400 INVALID_IMAGE_OPTIMIZE_REQUEST` → initials
   fallback. Fix: never nest `/api/media` in `/_vercel/image` (`d86e051`);
   accept `photo_url \|\| photo` (`27bca8a`).
6. **Vercel dashboard Framework Preset = “React Router”** reintroduces the
   original outage class. Must be **Other / None**. Overrides off; `vercel.json`
   owns build/output.

#### Smoke that must pass (content-type, not just status)

```
GET /              → 200 text/html + header X-MuviDB-SSR: ok
GET /api/films     → 200 application/json
GET /sitemap.xml   → 200 text/xml
Person hero img    → src="/api/media?url=…" and that URL returns image/*
```

Verified 2026-07-24 on staging preview and on **https://muvidb.com**.

#### ✅ Phase 3 list pages — loaders + meta (2026-07-24, `aac5051`)

Public SSR Phase 3 is complete. Route wrappers + `loader`/`meta`/edge cache;
pages seed `loading=false` from `useLoaderData` so the server HTML is the real
grid (skeleton-on-server was the trap):

| Route | Wrapper |
|---|---|
| `/people` | `src/routes/people-list.tsx` |
| `/channels` | `src/routes/channels-list.tsx` |
| `/companies` | `src/routes/companies-list.tsx` |
| `/cinemas` | `src/routes/cinemas-list.tsx` |
| `/showtimes` | `src/routes/showtimes.tsx` |
| `/tv-shows` | `src/routes/tv-shows.tsx` |

Already done earlier in Phase 3: Home, Browse, Search (meta-only), Film/Person
detail, Watch platform, Cinema/Channel/Company detail.

Removed `document.title` effects on Channels/Cinemas/TVShows (route `meta`
owns the title). Showtimes seeds Lagos `selectedDate` from the loader.

**Verified live:** each list URL returns large HTML with correct `<title>` and
seeded cards (not skeletons). Admin/auth/static stay client-side on purpose.

Scale path (not required yet): `server/node-server.mjs`, `Dockerfile`,
`npm run smoke:ssr`, `docs/SSR_SCALE.md`.

---

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

### ✅ Credit extractor — multi-image upload 2026-07-24
`src/pages/admin/AdminCreditsExtractor.jsx` accepted one screenshot at a time; a
credit roll rarely fits in one frame.

- `screenshotBase64`/`screenshotPreview` (single) → `screenshots[]`
  (`{id, name, base64}`); file input takes `multiple`.
- Thumbnail grid with per-image remove + "clear all"; input value is reset after
  each pick so the same file can be re-added after removal.
- Extraction loops the images **sequentially, not in parallel** — the Vision
  endpoint rotates API keys, and parallel calls burn quota far faster than they
  save wall-clock time.
- **One bad image no longer discards the batch**: each is caught individually and
  rows already harvested are kept. Log shows per-image success/failure.
- **De-dupes across images** on `name|role` (also against rows already on screen),
  because consecutive frames of a credit roll overlap heavily. Toast reports
  extracted / duplicates skipped / images failed.
- Profile verification runs once on the merged list, so matching sees every image.

`tsc` clean, build passes, no stale references to the old single-image state.

> **Not visually tested** — it is behind admin auth. Worth one manual run with 2–3
> overlapping screenshots to confirm the de-dupe count looks right.

---

## Pending

### 0. Homepage performance — pass 1 DONE (`e8de7fd`, 2026-07-25)

Baseline → after (mobile lab avg): Perf 27→36, LCP 18.9s→10.8s, TBT 27s→5.8s,
DOM 3481→1381. Warm run peaked Perf 43 / LCP 4.8s.

**Shipped:** `DeferredMount` + priority/secondary fetch split; loading flags
start false; lazy GenreRail/TopTen/PersonCard/FilmCard; PlatformRail without
motion; GenreRail poster-grid skip; FilmRow/cinema caps; leaner hero loader.

**Optional pass 2 (not started):** What’s New tab consolidation, move Google-about
block below priority rails, more unused-JS trimming.

### 1. Scale off Vercel Hobby if limits bite (optional)

`server/node-server.mjs` + `Dockerfile` + `docs/SSR_SCALE.md` are ready. Do not
migrate hosts preemptively — only if cold starts / function caps become real pain.

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

1. **Verify deploys by response body, not status code.** Framework-mode SSR
   returned `200` on every `/api/*` while serving the HTML shell. Status said
   healthy; content-type said the API layer was gone.
2. **`framework: "react-router"` / dashboard preset “React Router” zeros `api/`.**
   Declaring `functions.api/**` cannot bring them back. Invert: `framework: null`
   + `api/ssr.ts`. Never re-enable the React Router Vercel preset.
3. **Verify the *staged* diff, not the working tree.** `git add` with a pathspec
   that no longer exists fatals before staging anything, and a local build still
   passes because it reads the working tree. This shipped a broken commit once and
   a silently half-applied Phase 0 for weeks.
4. **A loading flag that starts `true` defeats SSR.** Components gated on it
   server-render a skeleton. Hit three times (AuthContext, `isHeroLoading`,
   Browse's `loading`).
5. **Don't assume a dirty file is someone else's work** — check `git diff` on it.
   `api/media.ts` sat uncommitted for a whole session because it was misread as
   unrelated local WIP.
6. **Merging SSR into a SPA rollback branch:** conflict resolution must take the
   SSR `vite.config.ts` (with `reactRouter()`). Taking “ours” SPA config breaks
   `react-router build` with “React Router Vite plugin not found”.
7. **Do not nest `/api/media` inside `/_vercel/image`.** Vercel image optimizer
   returns `INVALID_IMAGE_OPTIMIZE_REQUEST`; UI falls back to initials while cards
   (raw URLs) still look fine — easy to misdiagnose as “detail page data missing”.
