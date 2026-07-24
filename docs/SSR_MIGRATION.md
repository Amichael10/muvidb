# MuviDB → Server-Side Rendering: migration plan & progress

**Purpose of this file:** a self-contained handoff so *any* AI agent or developer can
continue this migration without the original conversation. Read it top to bottom,
then look at **"Current status"** for exactly where to pick up. Update the checkboxes
and the status section as you go.

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
- [x] Vercel preset wired (`@vercel/react-router`) — deploys as one SSR function.
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

### Phase 1b — Cutover (REQUIRED before this can ship)
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

### Phase 3 — Page by page
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

**Phase 1 scaffold works, on branch `ssr-phase-1` (not merged).** RR7 framework mode
builds and genuinely server-renders. Verified locally: `curl /` returns real markup,
no hydration errors, page renders. Three real SSR blockers fixed on the way
(AuthContext spinner gate, ThemeContext localStorage, module-scope PostHog).

**Next action:** Phase 1b + Phase 2 together — they're entangled and must land as one
change. `api/seo.ts` owns the six detail-page routes and serves them from
`dist/index.html`, which framework mode no longer produces, so its meta injection has
to be replaced by route `meta` exports, and those need loaders. See the Phase 1b
checklist. **Do not merge `ssr-phase-1` before that**: SSR builds fine, but the six
detail routes would 500 in production.

Also still outstanding from Phase 0: the deploy smoke-test below (rewrites can only be
verified on a real deployment).

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
