# Social Studio — Implementation Notes And Handoff

Last updated: 2026-07-31

> Filename is historical. This doc now covers Phase 1 **and** Phase 2 work.
> Read the Handoff section first; the rest is reference.

---

# HANDOFF: WHERE THIS STOPPED

## Status at a glance

| Area | State |
|---|---|
| Phase 1 — schema, RLS, flags, mock publisher, status page | **Done, migration applied to remote** |
| Migration history reconciliation | **Done** |
| Phase 2 slice 1 — content generation | **Done, verified against live data** |
| Phase 2 slice 2 — asset rendering | **Done and wired end to end** |
| Cloudinary cut-out pipeline | **Done** — migration, rotation, batch job, cron |
| Phase 2 slice 3 — review / approve | **Done** |
| Phase 2 slice 4 — schedule → enqueue → publish | **Done** |
| Phase 3 — OAuth + live Meta/TikTok | Not started, deliberately |

Everything is still **mock-only**. `SOCIAL_STUDIO_ENABLED` defaults to `false`.
No live provider calls exist anywhere in the codebase.

## The pipeline now runs end to end

One call to `POST /api/social?task=generate_draft` produces a content item, three
rendered PNGs stored in the bucket, `social_assets` rows, per-platform variants
each pointing at the right asset, and previews in the admin UI.

Verified against live data: 3 assets stored and publicly fetchable, and
`selected_asset_id` resolving correctly — Instagram/Threads to `portrait_4_5`,
TikTok to `vertical_9_16`. Test rows and objects were deleted afterwards.

**Watch the request budget.** A full generate took **32.8s** against
`maxDuration: 60` on `api/social.ts`: fetching the cut-out, three satori renders,
three uploads, three inserts. It fits, but there is not much headroom. Adding
formats or slower artwork fetches could push it over — move rendering to a queue
before adding a fourth format.

Asset rendering never fails generation. If it throws, the item still becomes a
`draft` with a caption-only body and a reviewer warning, and
`selected_asset_id` stays null.

## Review and approve (slice 3)

`POST /api/social?task=review` with `{ contentItemId, action, reason? }`, where
action is `submit | approve | reject | reopen`. Buttons appear per row in the
Recent Drafts panel, driven by the item's current status.

Legality is enforced server-side from `transitions.ts`, not in the UI, so a
stale browser tab cannot approve something another reviewer already rejected.
Approving cascades draft variants to `approved`, which is what makes them
eligible for scheduling; reopening pulls them back. Only untouched variants
move, so anything already published or skipped is left alone.

Two rules came out of testing the real lifecycle:

- **No-op reviews are refused.** `canTransitionContentStatus` permits
  self-transitions, so re-approving an approved item silently overwrote
  `approved_by`/`approved_at` and lost the original reviewer. Same-status review
  actions now 409.
- **`approved → draft` was added to the transition table.** Approval was
  previously a dead end: a mis-click could never be undone. Reopening is only
  legal before scheduling — `scheduled` and `publishing` remain one-way, because
  the job queue owns the item from that point.

## Scheduling (slice 4)

`POST /api/social?task=schedule` with `{ contentItemId, scheduledFor }` (ISO).
A `datetime-local` input appears on approved rows; the browser's zone is
converted to an absolute instant before sending.

It writes `scheduled_for` on every approved variant, moves them to `scheduled`,
and enqueues one `social_publish_jobs` row each. Jobs use the deterministic key
`social:<item>:<platform>:<time>` on a unique column, so the same instant cannot
double-post.

Guards, all exercised against the live database:

- A past `scheduledFor` is refused (60s of slack for clock skew).
- An unparseable date is refused.
- Variants with no rendered asset are refused **by name**, because every target
  platform posts media and the failure would otherwise surface inside the
  publisher.
- **Only `approved` items can be scheduled.** This is deliberately narrower than
  the transition table, which also permits `scheduled -> scheduled`. Rescheduling
  would have to move already-`scheduled` variants and cancel their outstanding
  jobs; this function only promotes `approved` ones, so a reschedule would
  silently half-apply.

## Verified end to end

generate → submit → approve → schedule → mock publish, against live data:
2 jobs queued, both processed, item reached `published`, Instagram `published`
and TikTok `uploaded_as_draft` (its dedicated draft-upload status from Phase 1).

## Cancel and reschedule

`POST /api/social?task=cancel_schedule` with `{ contentItemId }` returns a
scheduled item to `approved`, cancels its queued jobs and clears
`scheduled_for`. **Rescheduling is cancel-then-schedule**, not an in-place edit:
queued jobs carry the old timestamp inside their idempotency key, so they have
to be cancelled regardless — two explicit steps beat two code paths that can
disagree.

Jobs already `processing` are left alone and reported back as `inFlight`; the
adapter is mid-flight by then. Cancelled job rows are kept as an audit trail and
the publisher ignores them.

`scheduled → approved` was added to both the content and variant transition
tables. `publishing → approved` is deliberately still illegal.

## Asset retention

`pruneSocialAssets()`, wired as cron `task=social_prune_assets`. Deletes storage
objects and `social_assets` rows for terminal items
(`published`/`archived`/`rejected`), clearing `selected_asset_id` first so
nothing points at a missing file. Content items, variants and the event log are
kept — this reclaims bytes, not history. Window is
`SOCIAL_ASSET_RETENTION_DAYS`, default 30.

**Age is measured from `published_at`, not `updated_at`.** `social_content_items`
has an `updated_at` trigger, so that column tracks the last edit and can never
age while anything touches the row — an early version of this silently pruned
nothing. Items that never published fall back to `created_at`.

## NEXT

- **More card types.** 1 of ~19 designed cards is built. Each needs a domain
  type, a `cardCopy()` branch, a source loader and a template row — no migration.
  The editorial roundups (`today-in-africa`, `this-week-top-rated`,
  `africa-stories`) need a schema decision first: they are multi-title, and the
  schema assumes one `source_entity_id` per item.
- **Phase 3.** OAuth and live Meta/TikTok adapters, behind `SOCIAL_PUBLISH_MODE`.
  Still deliberately untouched.

## BLOCKED ON USER: the card design

The current card design in `social_render.ts` is a **placeholder I invented**.
The user has said it is not good enough and is supplying their own design.

Requested from the user (2026-07-31), still outstanding:

- PNG exports at exactly **1080×1350** (4:5), **1080×1080** (1:1),
  **1080×1920** (9:16), for both Actor Spotlight and Upcoming Movie.
  Minimum useful set is the two 4:5 cards.
- Mockups filled with real content, deliberately including one long name and one
  long film title, so text-overflow behaviour is specified rather than guessed.
- A note mapping each text element to its data field.
- Any non-brand hex colors, and font files for any font that is not
  Outfit / Syne / Inter.

Do **not** polish the placeholder design further. Swap it when the user's design
arrives. The card lives in one function, `buildCard()`, so replacing it does not
touch the plumbing.

### Fix these when reworking the card

- Badge uses `#E23E2D`. The real brand orange is `#FF5A1F`
  (`--color-brand` in `src/index.css`; hover `#E64A19`).
- "MUVIDB" is typeset as text. Use the real mark from
  `public/images/MuviDB Brand/` — `White Wordmark.svg` on dark cards. That
  folder already has logo, wordmark and icon in black/white/orange/red as
  SVG, PNG and JPG. No brand assets need to be created.

### 9:16 safe areas

Instagram Stories and TikTok overlay their own UI on roughly the top ~250px and
bottom ~400px of a 1080×1920 card. Keep meaningful content out of those bands.

---

# GOTCHAS THAT COST TIME

Each of these was discovered the hard way. Do not re-derive them.

## `/api/social` returns 404 under `npm run dev`

Vercel functions are not served by `vite dev`, and `vite.config.ts` answers any
unproxied `/api/*` with a 404 JSON stub. Consequences in local dev:

- `GET /api/social` 404s, so `getSocialStudioSummary()` never loads and the page
  falls back to `emptySummary`. `/admin/social` therefore shows **"FLAG OFF" and
  all-zero metrics regardless of the real flag or database contents.** The DB
  does have two active templates.
- Generate Draft stays disabled, because it is gated on `summary.enabled`.

This is pre-existing behaviour, not caused by the Social Studio work. To
exercise the endpoint use `vercel dev` or a Vercel preview deploy. Note that
neither `.env` nor `.env.local` currently defines any `SOCIAL_*` flag.

## Satori silently ignores parts of the CSS it documents

Confirmed by dumping satori's SVG output:

- `objectFit: 'cover'` on `<img>` — ignored, emits
  `preserveAspectRatio="meet"`, which letterboxes.
- `backgroundSize` (keyword *and* explicit px) — ignored, background draws at
  natural size.

Neither errors. They fail quietly and you only notice in the pixels. The working
approach is to compute the cover box yourself and set explicit `width`/`height`
on the `<img>`, so the aspect ratio already matches and `meet` has nothing to
letterbox. That is what `buildCard()` does.

`SOCIAL_RENDER_DEBUG_SVG=1` makes the renderer print the emitted `<image>`
element. Use it before theorising about layout.

Broader constraint: satori supports flexbox only (no CSS grid), and effects like
backdrop-filter and blend modes are unsupported or degraded. **If the user's
design depends on those, satori may be the wrong renderer and the Playwright
option should be reconsidered.**

## YouTube artwork has letterbox bars baked into the file

`films.poster_url` for YouTube-sourced films usually points at
`i.ytimg.com/vi/<id>/hqdefault.jpg`, which is a fixed **480×360** canvas with
black bars burned into the image itself. Upscaling that to 1080×1920 looks
terrible and puts the bars in the card.

`artworkCandidates()` therefore tries `maxresdefault.jpg` (1280×720, no bars)
first and falls back to the stored URL. This produced a dramatic quality jump.

Time was lost "fixing" satori twice for what was actually bars in the source
image. When artwork looks wrong, **look at the raw source file first.**

## `scratch/` is tracked by git

`scratch/` holds ~126 committed files. `rm -rf scratch` deletes them
(recoverable via `git restore scratch/`). The `db-check` skill used to call it
gitignored; that line has been corrected. Delete probe scripts by name.

---

# WHAT EXISTS TODAY

## File inventory

| Path | Role |
|---|---|
| `supabase/migrations/20260730211114_social_studio_foundation.sql` | Schema, RLS, bucket, seed templates. Applied. |
| `api/_lib/social_studio.ts` | Auth guards, summary, `generateSocialDraft()`, mock publisher |
| `api/_lib/social_render.ts` | satori + resvg renderer. **Not yet called.** |
| `api/_lib/social_render.test.ts` | `imageSize` header parsing, format aspect ratios |
| `api/_lib/fonts/*.woff` | Syne 800, Outfit 400/600. Vendored, 54KB total. |
| `api/social.ts` | `GET` summary, `POST task=generate_draft`, `POST task=publish_due` |
| `api/cron/sync.ts` | `task=social_publish` branch |
| `src/features/social-studio/domain/**` | Content/platform/status types, transitions, validation |
| `src/features/social-studio/platforms/**` | Adapter interface, mock adapter, error types |
| `src/features/social-studio/content/snapshots.ts` | Frozen `source_snapshot` builders + warnings |
| `src/features/social-studio/content/caption-builder.ts` | Per-platform caption/title/hashtags |
| `src/features/social-studio/content/copy-quality.ts` | Rejects scraped junk copy |
| `src/components/admin/SocialDraftComposer.jsx` | Generate-draft UI |
| `src/pages/admin/AdminSocialStudio.jsx` | Status page, metrics, recent drafts |

Tests: `npm.cmd run test -- src/features/social-studio api/_lib` → 49 passing.
`npm.cmd run lint` and `npm.cmd run build` both pass.

## Phase 1

- Additive schema: 7 `social_*` tables, 6 enums, RLS with one admin-only policy
  each, `public.is_social_studio_admin()` (excludes `admin_limited`).
- Public-read bucket `social-published-assets`, admin-only writes.
- Flags: `SOCIAL_STUDIO_ENABLED`, `SOCIAL_PUBLISH_MODE`,
  `SOCIAL_DEFAULT_TIMEZONE`, `SOCIAL_ASSET_BUCKET`.
- Mock adapter with deterministic success/failure; publisher with job claiming,
  retry backoff, event log, and content-status rollup.
- Full-admin `/admin/social` page.

Verified after the migration applied: all 7 tables have RLS on, the bucket is
public, both seed templates are active, every status literal in code matches the
live enum labels, and the anon key is denied on all 7 tables.

## Phase 2 slice 1 — content generation

Phase 1 built the back half of the pipeline but nothing could enter it. This
slice added the entry point: `generateSocialDraft()`, exposed as
`POST /api/social?task=generate_draft`, parsed by the pre-existing
`parseGenerateDraftRequest`.

Items insert as `generating` and only move to `draft` once variants exist, so a
partial failure is visibly incomplete rather than looking review-ready.
Generation refuses when an item for the same source is already active and
returns the existing id.

**Copy quality:** `films.synopsis` and `people.bio` are frequently scraped
YouTube descriptions — one real film's synopsis is nothing but `#tag #tag #tag`,
which produced a caption that was a wall of hashtags. `isUsableCopy()` drops
copy whose hashtag/URL token ratio exceeds 25%, and the caption falls back to
the next source. The word floor is deliberately 3, because real taglines are
terse ("A warrior never kneels." must pass).

Verified against live data: both content types generate; the hashtag dump is
dropped with a reviewer warning; caption plus hashtag block stays within every
platform limit (Threads landed at 497/500 with tags intact); duplicate source
returns 409, unknown source 404. All probe rows were deleted afterwards.

Verified in the browser as a signed-in full admin: page, composer and drafts
panel render with no console errors; debounced search reads `people` through RLS
and returns results with photos.

## Phase 2 slice 2 — renderer (built, not wired)

Chosen approach: **satori + `@resvg/resvg-js`, in-process inside
`api/social.ts`.**

Why, briefly:

- No new Vercel function. The project is at 9 and has consolidated before.
- Must run unattended — a cron publisher already exists and scheduled
  generation is the obvious Phase 3 want. Client-side canvas rendering needs an
  admin's browser open, so it structurally cannot participate.
- Playwright cannot fit a serverless function, so it would have to live in a
  GitHub Action — an async, minutes-long round trip that breaks the review loop,
  since a reviewer needs to see the image to approve it.

Trade-off accepted: satori renders a CSS subset (see gotchas). Revisit only if
the user's design needs effects satori cannot do.

Implemented: three formats (1080×1350, 1080×1080, 1080×1920), vendored fonts,
artwork inlined as data URIs, `imageSize()` header parsing for PNG/JPEG/GIF/WebP
so the cover box can be computed without an image-decoding dependency, graceful
degradation to a typographic card when artwork can't be fetched.

`vercel.json` sets `includeFiles: "api/_lib/fonts/**"` on `api/social.ts`.
Without it the fonts do not ship and rendering fails **in production only.**

Deploy risk: `@resvg/resvg-js` uses native bindings, so only the Windows binary
is present locally and Vercel resolves the Linux one at install. If that ever
misbehaves, `@resvg/resvg-wasm` is a drop-in swap isolated to this one module.

---

# REFERENCE

## Architecture

- React 19, React Router 7 framework mode, Vite 6.
- Vercel with consolidated `api/*.ts` functions plus `api/ssr.ts`.
- Supabase Postgres, timestamped migrations in `supabase/migrations`.
- Supabase Auth, roles in `public.users.role`.
- `/admin/*` in `src/routes.ts` under `routes/require-admin.tsx`; full-admin-only
  routes nest under `routes/require-admin-strict.tsx`.

## Source data

- `people`: `id`, `name`, `photo_url`, `nationality`, `known_for_department`, `bio`.
- `credits`: joins `people` to `films` with `role`, `character_name`, `billing_order`.
- `films`: `id`, `slug`, `title`, `poster_url`, `backdrop_url`, `release_date`,
  `year`, `synopsis`, `tagline`, `genres`, `countries`, `languages`,
  `liked_percent`, `coming_soon`, `is_published`.
- `spotlights` stores editorial homepage spotlights and is unrelated to this
  publishing workflow.

## Spec adaptations

- The original spec references Next.js `src/app`; this repo uses React Router
  routes and Vercel API functions.
- Mock-only. No OAuth or live provider calls.
- `admin_limited` is excluded via a stricter DB helper and strict admin route.
- The summary endpoint avoids querying new tables while the flag is false, so a
  code deploy is safe before the migration is applied.
- TikTok has a dedicated `uploaded_as_draft` variant status, matching the later
  TikTok draft-upload behaviour in the spec.

## Regenerating database types

```bash
npx supabase gen types typescript --linked --schema public --schema graphql_public
```

The `graphql_public` schema **must** be included or the existing `graphql` types
are silently dropped from `src/types/supabase.ts`.

## Migration history reconciliation (2026-07-30)

`npx supabase db push` initially refused to run because the remote had seven
applied migration versions with no local file. All seven belong to the
film-related / credit-harvest line, not Social Studio.

They were reconciled by restoring the files, not by running
`supabase migration repair`, because the migrations really are applied and their
history rows should stay intact:

| Version | Name | Source |
| --- | --- | --- |
| 20260728002546 | `film_related` | restored from `origin/staging` |
| 20260728002727 | `film_related_grants` | restored from `origin/staging` |
| 20260728010500 | `credit_harvest` | restored from `origin/staging` |
| 20260729023500 | `atomic_credit_harvest_claim` | reconstructed from remote history |
| 20260729132000 | `credit_candidate_layout_review` | reconstructed from remote history |
| 20260729175500 | `credit_review_film_pagination` | reconstructed from remote history |
| 20260729210500 | `atomic_credit_candidate_approval` | reconstructed from remote history |

The last four had never been committed to any branch. Their SQL was recovered
from the `statements` column of `supabase_migrations.schema_migrations` on the
remote and written back out, so a future `supabase db reset` reproduces the same
schema. Each carries a header noting it was reconstructed.

Because local filenames now match versions already in remote history, the CLI
treats them as applied and does not re-run them.
