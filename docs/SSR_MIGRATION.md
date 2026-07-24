# MuviDB → Server-Side Rendering: migration plan & progress

**Purpose of this file:** a self-contained handoff so *any* AI agent or developer can
continue this migration without the original conversation. Read it top to bottom,
then look at **"Current status"** for exactly where to pick up. Update the checkboxes
and the status section as you go.

> **⚠️ PACKAGING BANNER (2026-07-24) — read before touching Vercel config**
>
> Do **NOT** re-add `"framework": "react-router"` to `vercel.json`, and do **NOT**
> re-add `@vercel/react-router` / `vercelPreset()` to `react-router.config.ts`.
> That combo makes Vercel’s Build Output API own the deploy and zeroes out `api/`
> detection — every `/api/*` route then returns the SSR shell (verified failure).
>
> **Correct packaging (invert-fix):** keep normal `api/*.ts` detection, build with
> `react-router build` → `build/client` + `build/server`, serve pages via
> `api/ssr.ts` (`createRequestHandler` + `includeFiles: build/server/**`), static
> assets from `outputDirectory: "build/client"`, catch-all rewrite
> `/((?!api/).*)` → `/api/ssr`. Details: `docs/WORK_LOG.md` § “The fix: invert it”.
> Branch: `ssr-packaging-fix`.

---

## The goal (decided with the owner)

Make MuviDB **server-rendered** so pages arrive as complete HTML (fast first paint,
good SEO), instead of the current client-only SPA that ships an empty shell and then
fetches data in the browser.

Reference that prompted this: `lookmovie2.to` feels instant because it server-renders
its HTML (Rails/nginx) and serves resized WebP images. MuviDB (Vite + React SPA) makes
each visitor download JS → boot React → query Supabase → *then* render.

**Approach: incremental, hybrid.** Convert page by page. Start with **Home**. Public
content pages (Home, Browse, Film, Person) benefit most; the **Admin dashboard and
logged-in flows can stay client-side indefinitely**.

## Hard constraints (do not violate)

1. **Stay on Vercel Hobby (free).** No $20/mo Pro yet — not profitable.
   - Hobby caps at **~12 Serverless Functions per deployment**. Currently at 12
     (11 in `api/*.ts` + `api/cron/sync.ts`). **Must free slots before adding SSR.**
   - Good news: a real SSR framework serves the *whole app from ~1 function*, so SSR
     does not multiply functions.
2. **The DB is slow (8–15s under load; has timed out this month).** Therefore **naïve
   SSR that queries Supabase on every request would make pages SLOWER.** Every
   server-rendered page MUST use caching / ISR (render once, cache, revalidate every
   few minutes). Caching is not optional — it's the whole point.
3. Don't break the existing SPA while migrating. Hybrid: unconverted routes keep
   working client-side.

## Stack (as of this doc)

- React 19, **react-router-dom 7** (declarative `<Routes>` mode — NOT framework mode yet),
  Vite 6, `@vitejs/plugin-react`.
- Deploy: Vercel. Serverless functions in `api/*.ts` (`@vercel/node`). Cron in `api/cron/`.
- Data: Supabase. Frontend reads Supabase **directly from the browser** with the anon
  key (RLS enforced) inside `useEffect` on each page.
- `vercel.json` already remaps public URLs to query-dispatch handlers
  (e.g. `/api/film/:id` → `/api/films?id=`). Reuse this pattern for consolidation.
- Supabase **image transforms are already wired** in `vercel.json`
  (`/storage/v1/render/image/public/*`) — resized WebP is available today.

## Chosen framework: React Router 7 "framework mode"

Rationale: the app is already on RR7. Framework mode = Remix, merged into RR7. It:
- Server-renders the whole app from **one** Vercel function (fits Hobby).
- Uses `loader` functions for server-side data (replaces the `useEffect` fetches).
- Converts page-by-page — a route without a loader still works.
- Reuses existing React components.

(Alternatives considered: Next.js — bigger ecosystem but a full router/RSC rewrite;
Vike — keeps Vite, smaller community. RR7 chosen for least churn.)

---

## Phased plan

### Phase 0 — Consolidate API functions (free up Hobby slots)  ⬅ START HERE
Merge backends into fewer files; keep public URLs identical via `vercel.json` rewrites
so **frontend callers don't change**. Target: 12 → ~6 functions.

Proposed mapping (dispatch by `?resource=` / `?action=`):

| New function | Absorbs | Public paths kept via rewrite |
|---|---|---|
| `api/data.ts` | films, people, channels, content | `/api/films`, `/api/people`, `/api/channels`, `/api/content` |
| `api/media.ts` (extend) | media, mirror-images, health | `/api/media`, `/api/mirror-images`, `/api/health` |
| `api/external.ts` (keep) | external (youtube/tmdb proxy) | `/api/youtube`, `/api/tmdb` |
| `api/ai.ts` (keep) | ai (717L, distinct) | `/api/ai` |
| `api/automation.ts` (keep) | automation (admin: scrape/dedup/enrich) | `/api/scrape-imdb-actor`, `/api/deduplicator`, `/api/people-enrichment` |
| `api/seo.ts` (keep) | seo (sitemap, 475L, cached) | `/sitemap.xml`, `/api/seo` |
| `api/cron/sync.ts` (keep) | cron | `/api/cron/*` |

Pattern: refactor each merged handler into a named export `handleX(req,res)`; the new
router file reads `req.query.resource`/path and delegates. Add `vercel.json` rewrites
mapping old public paths to `dest: "/api/data?resource=films"` etc. Verify with
`npm run build` and by hitting each old path.

- [x] Merge films/people/channels/content → `api/data.ts` (+ rewrites) — **DONE**
      Each moved to `_lib/<name>_handler.ts` as `handleFilms`/`handlePeople`/
      `handleChannels`/`handleContent`; `api/data.ts` dispatches on **`?_r=`**.
      **The router param is `_r`, NOT `resource`** — `content.ts` already owns
      `?resource=` (`film-credits`, `person-credits`, `person-films`,
      `film-reviews`) and 5 frontend files call it that way, so `resource` would
      have collided with the caller's own value. The `/api/film/:id`,
      `/api/channel/:id` and `/api/admin/search-channels` rewrites were repointed
      **directly** at `/api/data?_r=…` rather than relying on a second rewrite hop
      through the now-deleted `/api/films`/`/api/channels` files.
      Also normalised extensionless imports (`./supabase` → `./supabase.js`) —
      tolerated when these were standalone functions, but they must carry
      extensions now that the router imports them as ESM modules. **10 → 7.**
- [x] Fold media/mirror-images/health → `api/media.ts` (+ rewrites) — **DONE**
      `health.ts`→`_lib/health.ts` (`handleHealth`), `mirror-images.ts`→
      `_lib/mirror_images_admin.ts` (`handleMirrorImages`); `media.ts` dispatches on
      `?op=health|mirror`, default = image proxy. Rewrites keep `/api/health`,
      `/api/mirror-images` public. Build passes. **12 → 10 functions.**
- [x] Confirm final function count ≤ 8 — **now 7**: `ai`, `automation`, `data`,
      `external`, `media`, `seo`, `cron/sync`. `npm run build` passes and
      `tsc --noEmit` on `api/data.ts` is clean. **~5 slots free for SSR.**
- [ ] Smoke-test the old public paths against the deployed preview (see
      "Verify current state" below) — the rewrites are only exercisable in deploy,
      not locally.

**To do the `api/data.ts` merge (next), copy the media pattern exactly:**
move `films.ts`/`people.ts`/`channels.ts`/`content.ts` → `api/_lib/*_handler.ts` as
named exports (fix `./_lib/` → `./` imports), create `api/data.ts` dispatching on
`?resource=films|people|channels|content`, and add rewrites
`/api/films → /api/data?resource=films` (etc.) BEFORE the `/api/(.*)` catch-all in
`vercel.json`. Note `films.ts` is already reachable via `/api/film/:id` rewrite — keep it.
Verify with `npm run build` and by curling each old path.

### Phase 1 — Stand up RR7 framework mode (SSR foundation)
**Status: scaffold works on branch `ssr-phase-1`. NOT merged — see "Before cutover".**

- [x] RR7 framework-mode Vite plugin + route config, keeping `appDirectory: 'src'`
      so the ~50 existing pages stay put. `react-router.config.ts`, `src/root.tsx`
      (document + providers + chrome), `src/routes.ts` (mirrors the old `<Routes>`).
      Default `entry.client`/`entry.server` are used — no custom entries needed.
- [x] ~~Vercel preset wired (`@vercel/react-router`)~~ — **REVERTED.** Preset +
      `framework: "react-router"` zeroes out `api/` (see packaging banner above).
- [x] **Invert packaging** (`ssr-packaging-fix`): `api/ssr.ts` + `framework: null`
      + `outputDirectory: build/client` + catch-all excluding `/api`. Function
      count target: 7 existing APIs + 1 SSR = 8 (Hobby-safe).
- [x] Builds and server-renders. `npm run build` produces `build/client` +
      `build/server`; `curl /` returns **real markup** (639 divs, nav/main/footer,
      14 sections) instead of an empty shell. No console errors, no hydration
      mismatch, page renders correctly.
- [ ] **Auth:** cookie-based Supabase session via `@supabase/ssr` — still deferred,
      correctly. Guards remain client-side (see `src/components/routing/ProtectedRoute.tsx`).

**Three blocking things had to change to make SSR possible — all real bugs, not cosmetics:**
1. `AuthContext` rendered a full-screen spinner *instead of* `children` while
   `loading`. On the server `loading` starts true and the effect that clears it
   never runs, so **every route server-rendered nothing but a spinner**. Children
   now always render; `ProtectedRoute` still gates on `loading`, so guarded routes
   are never exposed. Tradeoff: auth-dependent chrome briefly shows its
   logged-out state before the session resolves.
2. `ThemeContext` called `localStorage.getItem` in a `useState` initialiser, which
   runs during server render → crash. Guarded with `typeof window`.
3. PostHog was initialised at module scope in `main.tsx` → would run on the
   server. Moved into a client effect with a dynamic import.

**Build-config changes:** `@vitejs/plugin-react` removed (reactRouter() provides
React handling; two React plugins conflict); `manualChunks` vendor-splitting
removed (framework mode does route-level splitting and the server bundle must
stay one module graph); `VitePWA` now client-build only.

### Phase 1b + 2 — DONE (on `ssr-phase-1`)
- [x] `api/seo.ts`'s per-entity meta ported to route `meta` exports. Logic lives in
      `src/lib/seo.server.ts` (DB queries) + `src/lib/seo.ts` (pure shaping).
      **They must stay split:** `meta` is a *client* export, so if it imports the
      server module React Router refuses to build ("other route exports depend on
      …server"), since that would pull the service-role client into the browser
      bundle. Only `loader`/`action`/`headers` may touch `.server` modules.
- [x] Six thin route wrappers in `src/routes/*-detail.tsx` add `loader`+`meta`+
      `headers` without touching the page components, which still fetch their own
      display data client-side.
- [x] Verified: `/films/asore-sika-part-1` server-renders
      `<title>Asore Sika PART 1 (2026) – Where to Watch | MuviDB</title>`, og:title,
      `robots: index, follow`, canonical, and the `Movie` JSON-LD — matching the
      old api/seo.ts output.
- [x] Six detail rewrites removed from `vercel.json`; `/sitemap*.xml` kept.
      `includeFiles: dist/index.html` removed. SPA fallback removed (SSR serves it).
- [x] `api/seo.ts`'s HTML branch returns 404 with a comment; its ~300 lines of now
      unreachable code should be deleted once the cutover is confirmed in prod.
- [x] **Home loader + edge cache.** `src/routes/home.tsx` server-renders the hero
      rail and sends `s-maxage=3600, stale-while-revalidate`. Verified: a real film
      link is in the server HTML.
      Deliberately **not** all ~15 rails — that would serialise ~15 queries against
      a DB that runs 8–15s and has thrown 57014, risking the function budget on a
      cache miss. Below-fold rails still hydrate client-side.

**Two more SSR-only bugs surfaced and were fixed:**
- `isHeroLoading` started `true`, so the server rendered the hero *skeleton* even
  with data seeded — same shape of bug as the AuthContext spinner. It's now seeded
  from the loader, and `fetchAllData` no longer flips it back after hydration.
- `src/lib/imageUrl.js` computed `isLocalhost` from `window.location.hostname` at
  module scope → server said "not localhost" and emitted `/_vercel/image` URLs while
  the browser emitted raw ones: a hydration mismatch. Dev-only (in prod both sides
  evaluate false and agree), now resolved via `import.meta.env.DEV`. Note this must
  be the **exact** token — `import.meta.env?.DEV` is not statically replaced by Vite
  and silently evaluates to undefined on the server.

**Still open before merge:**
- [ ] Deploy `ssr-packaging-fix` to a Vercel **preview** and smoke-test by
      **content-type** (not status code) — confirm APIs stay JSON/XML and pages
      are HTML from `api/ssr`. See checklist under Current status.
- [ ] Missing/thin entities set `robots: noindex` but still return **HTTP 200**;
      api/seo.ts returned 404. Soft-404 HTTP status is TODO (packaging priority).
- [ ] Remaining pages (PeopleList, Channels, …) still fetch client-side — Phase 3.

### Phase 1b — original cutover checklist (superseded by the above)
The scaffold runs, but **merging as-is would break production.** `api/seo.ts`
currently owns `/films/:slug`, `/people/:slug`, `/watch/:slug`, `/channels/:slug`,
`/companies/:slug`, `/cinemas/:slug` via `vercel.json` rewrites, and serves them by
`readFileSync('dist/index.html')` + injecting title/og/twitter/JSON-LD.

Under framework mode **there is no `dist/index.html`** (output moved to
`build/client` + `build/server`, and SSR generates the document from `root.tsx`),
so those routes would 500. Also `vercel.json` pins
`functions: { "api/seo.ts": { includeFiles: "dist/index.html" } }`.

- [ ] Port `api/seo.ts`'s per-entity meta into route `meta` exports. Needs the
      entity data server-side → this is really Phase 2 work (loaders), so Phase 1b
      and Phase 2 should land together.
- [ ] Drop the six detail-page rewrites from `vercel.json`; **keep** the
      `/sitemap*.xml` ones (that half of `api/seo.ts` is unaffected and still needed).
- [ ] Remove the now-dead entry points: `index.html`, `src/main.tsx`, `src/App.tsx`
      (superseded by `root.tsx` + `routes.ts`). Left in place on the branch so the
      scaffold stays a clean, revertible addition.
- [ ] Re-point the SPA fallback rewrite in `vercel.json` (`/(?!...)` → `/index.html`)
      at the SSR function.
- [ ] Confirm the deployed function count is still ≤ 12 with the SSR function added.

### Phase 2 — Convert Home to SSR + cache
- [ ] Move Home's rail queries (`src/pages/Home.jsx`, multiple `supabase.from('films')`
      selects) into a server `loader`.
- [ ] Precompute/cache the homepage payload (edge cache / ISR, `Cache-Control:
      s-maxage=…, stale-while-revalidate`). The slow DB must NOT be in the per-request path.
- [ ] Verify: `curl` the homepage → HTML contains the film grid; TTFB fast; no client
      Supabase call needed for first paint. Compare before/after.

### Phase 3 — progress

- [x] **Browse** — full loader + edge cache (`src/routes/browse.tsx`). Server-renders
      the first 50 results, cached per URL; the param space is bounded
      (`genre`/`country`/`sort`/`platform`) so the cache stays effective. Verified
      `?genre=Drama&sort=rating` shares **zero** results with the unfiltered page and
      an unknown genre returns none — the inner join and sort really apply.
      Only URL-derived filters can be server-rendered; the rest of Browse's filter
      state lives in component state, not the URL, so it stays client-side. The page
      seeds from the loader and skips only its on-mount fetch (via a ref).
      **Known duplication:** the loader restates Browse.jsx's query instead of sharing
      a builder, because one uses the browser client and the other the service-role
      one. Worth folding into a single builder that takes a client — if you change
      `fetchFilms`, change the loader too.
- [x] **Search** — `meta` only, **no loader, deliberately**. The query space is
      unbounded, so each distinct `?q=` would be a cache miss putting a
      user-controlled workload on the slow DB (and a cheap scraping lever), and
      search results shouldn't be indexed anyway, so SSR buys no SEO. The wrapper
      adds the `noindex` the page never had — as a client-only route it inherited the
      site-wide `index, follow`, so every crawled `/search?q=` was an index candidate.
- [x] **FilmDetail + PersonDetail** — bodies now server-rendered too, at **no extra
      query cost**: `filmSeo`/`personSeo` already fetched these rows for the head, so
      they now select the superset the pages render and the wrappers return the row
      next to the `seo` payload.
      The pages pass that row into `fetchFilm`/`fetchPerson` as `preloaded`, which
      skips **only the primary query** — credits, episodes, related films, the
      channel/YouTube fetches and the `increment_profile_views` write all still run
      client-side. That write must stay client-side: in a loader, edge caching would
      skew the counts. Seeding is one-shot per slug.
      `filmSeo` keeps its `is_published` filter, so unpublished films aren't seeded
      and fall back to the client fetch (which has no such filter) — unchanged
      behaviour, and they stay out of the index.
- [ ] Remaining: PeopleList, Channels, Companies, Cinemas, Showtimes, TVShows.

**Two traps this uncovered — expect both again on the remaining pages:**
- `ShareAction` read `window.location`/`document.title` during render and **500'd**
  the server the moment a real page body was rendered. It had never been
  server-rendered before, because these pages only ever reached the server as a
  skeleton. Any component that only appears inside a loaded page body is untested
  under SSR — grep for `window.`/`document.` outside effects before converting one.
- FilmDetail, PersonDetail and WatchPlatform each rendered a `<Helmet>` block that
  duplicated the route `meta`, emitting **two `<title>` tags per page**. All removed;
  the route `meta` supersedes them and carries the better SEO titles plus canonical,
  robots and JSON-LD. **If you convert a page, check it for `<Helmet>` too.** The
  only Helmet left is in the dead `src/main.tsx`.

**Pattern for the remaining pages** (all three steps needed — the first alone does
nothing visible):
1. Add `src/routes/<page>.tsx` re-exporting the page as default, plus `loader`,
   `meta`, `headers`; point `src/routes.ts` at it.
2. Seed the page's state from `useLoaderData()`.
3. **Seed the page's `loading`/skeleton flag too.** Every page here gates render on a
   `loading` boolean that starts `true`; leave it and the server renders a skeleton
   and SSR gains nothing. This has bitten three times now (AuthContext,
   `isHeroLoading`, Browse's `loading`).
Also delete any `document.title = …` effect — the `meta` export owns the title, and
the effect overwrites the server-rendered one after hydration.

### Phase 3 — original plan
Order by traffic/value: Browse → Film detail → Person detail → the rest. Each: move
`useEffect` fetch → `loader`, add caching, verify. Admin/auth pages may stay client-side.

---

## Gotchas / notes for the next agent

- **Caching is mandatory** (see constraint 2). A server-rendered page that queries the
  slow DB per request is a regression, not an improvement.
- **Browser-only code** (`window`, `localStorage`, `document`) crashes on the server —
  guard with `typeof window !== 'undefined'` or client-only components. AuthContext,
  any `localStorage` session read, some libs will need this.
- **Images:** use the already-wired Supabase transform (`?width=…&format=webp`) + add
  `loading="lazy"` + fixed width/height on cards to kill layout shift. This is a cheap
  win independent of SSR.
- **Hydration mismatch:** server HTML must match first client render. Watch dates,
  random ids, locale.
- Verify each step with `npm run build` (tsc + vite) and, for pages, `curl` the route to
  confirm content is in the HTML.

## Key files

- Routing: `src/App.tsx` (`<Routes>` at line ~222).
- Home: `src/pages/Home.jsx` (rail queries).
- API: `api/*.ts`, dispatch rewrites in `vercel.json`.
- Supabase browser client: `src/lib/supabase.js`. Service client (functions):
  `api/_lib/supabase.ts`.
- Shared person matcher already server-side: `api/_lib/tmdb_match.ts`,
  `person_name_key` (migration) — unrelated but shows the "one shared server rule" pattern.

---

## Current status

**Last updated:** 2026-07-24.
**Done: Phase 0 is COMPLETE.** Both folds landed — health + mirror-images → `api/media.ts`
(`?op=`), and films/people/channels/content → `api/data.ts` (`?_r=`). All public URLs
preserved by `vercel.json` rewrites, so **no frontend caller changed**. Build passes,
`tsc` clean. **Function count 12 → 7**, leaving ~5 Hobby slots for SSR.

**Phases 1–3 page work is on `ssr-phase-1`; packaging fix is on `ssr-packaging-fix`
(based on `ssr-phase-1` @ `26b72a3`). NOT merged, NOT deployed.** `main` stays on
the SPA + Phase 0 APIs until preview smoke-tests pass.

**Packaging:** invert-fix — no `vercelPreset`, no `framework: "react-router"`.
SSR is `api/ssr.ts`. See banner at top of this file.

Branch commits, oldest first:
- `d2a19ab` — Phase 1: RR7 framework-mode scaffold (SSR foundation).
- `0aa21c6` — Phase 1b + 2: api/seo.ts meta ported to route loaders; Home hero
  server-rendered + edge-cached.

Verified locally (`npm run build` passes, `react-router dev` on :3001):
- `curl /` returns real markup (nav/main/footer, ~639 divs) with a real film link
  from the hero loader — not an empty SPA shell.
- `curl /films/asore-sika-part-1` returns the same title / og / robots / canonical /
  `Movie` JSON-LD the old api/seo.ts produced.
- No hydration mismatches; page renders correctly in the browser.

**First preview deploy FAILED** (`No Output Directory named "dist"`), then
`framework: "react-router"` was tried so Vercel would run the RR builder. That
fixed the output-dir error **but** switched off `api/` detection — every API
returned the SSR shell. **Do not restore that.** The invert-fix on
`ssr-packaging-fix` sets `"framework": null`, `outputDirectory: "build/client"`,
and `api/ssr.ts` with `includeFiles: "build/server/**"`.

If a deploy still looks for `dist` or React Router framework output, check
**Project Settings → Framework Preset** in the Vercel dashboard; a dashboard
override can win over `vercel.json`. Set it to **Other** (or unset).

### ⚠️ NEXT ACTION — preview-deploy `ssr-packaging-fix` and smoke-test by content-type

Everything below can **only** be checked on a real deployment. Do not merge to
`main` before this passes. **Verify content-type / body, never status alone**
(SSR shell returns 200 for shadowed APIs).

1. Push a preview deploy of `ssr-packaging-fix` (do NOT promote to production).
2. Phase 0 API checks (expect **JSON**, not `text/html`):
   - `/api/films?limit=1`, `/api/people?limit=1`, `/api/channels?limit=1`
   - `/api/content?resource=film-credits&filmId=<uuid>`
   - `/api/health?service=youtube`, `/api/media?url=…`
3. Sitemaps (expect **XML**): `/sitemap.xml`, `/sitemap-films.xml`, …
4. SSR pages (expect **HTML** with real markup, not empty shell):
   - `/` — hero film link present; prefer `Cache-Control: s-maxage=3600`
   - `/films/<slug>`, `/people/<slug>`, `/watch/netflix`, …
5. `/admin` still loads (client guard).
6. **Function count ≤ 12**, expected **8**: ai, automation, data, external, media,
   seo, cron/sync, **ssr**.
7. If it passes: merge to `main`, then `staging`. Then Phase 3 cleanup below.

**Known deviation to decide on:** missing/thin entities now return **HTTP 200 with
`robots: noindex`**, where api/seo.ts returned **404**. `noindex` is the operative
signal for Google, but the 404 was deliberate, to clear "Soft 404 / Crawled - not
indexed". Reproducing the status needs a custom `entry.server.tsx` that reads a
route `handle`. Owner has not yet decided whether this matters.

**Dead code to delete once the cutover is confirmed in production** (left in place
deliberately so the branch stays revertible):
- `index.html`, `src/main.tsx`, `src/App.tsx` — superseded by `src/root.tsx` +
  `src/routes.ts`. Nothing imports them; they are no longer entry points.
- `api/seo.ts` — everything after the early `return res.status(404)` is unreachable
  (~300 lines of HTML injection).

**Environment gotcha:** npm's cache is configured at `D:\npm-cache` and `D:` does not
exist, so every `npm install`/`npm view` fails with a bogus `ENOENT ... mkdir '\\?'`.
Work around per-command with `npm install --cache <writable-dir>`, or fix it for good
with `npm config set cache <writable-dir>`.

**Owner preferences:** free tier only for now; hybrid is fine; convert Home first.

**Verify current state** (run against the deployed preview URL, not localhost — the
`routes` rewrites do not apply to `vite dev`):
- `/api/films?limit=1` → 200 JSON  (rewrite → `/api/data?_r=films`)
- `/api/people?limit=1` → 200 JSON
- `/api/channels?limit=1` → 200 JSON
- `/api/content?resource=film-credits&filmId=<uuid>` → 200 JSON
  ← **the important one**: proves the caller's own `resource` param survives
  alongside the router's `_r`
- `/api/film/<uuid>` and `/api/channel/<uuid>` → 200 (repointed path rewrites)
- `/api/health?service=youtube`, `/api/mirror-images?table=films`, `/api/media?url=…`
