# Social Studio card designs — source mockups

Design reference for the Social Studio asset renderer
(`api/_lib/social_render.ts`). These are the authored designs; the renderer
rebuilds them in satori. See `docs/SOCIAL_STUDIO_PHASE1.md` for pipeline status.

## Delivered mockups (measured 2026-07-31)

25 PNGs are present. **Dimensions were measured, not taken from the filenames —
the two disagree constantly.** Most files named `-1x1` are not square.

| File | Measured | Ratio |
|---|---|---|
| `actor-spotlight-1080x1350.png` | 1080×1350 | 4:5 ✅ |
| `actor-spotlight-1080x1920.png` | 1080×1920 | 9:16 ✅ |
| `upcoming-spotlight-1x1.png.png` | 1080×1920 | **9:16**, not 1:1 |
| `actor-spotlight-b-1x1.png.png` | 1254×1254 | 1:1 |
| `birthday-spotlight-1x1.png.png` | 1254×1254 | 1:1 |
| `free-on-youtube-2-1x1.png.png` | 1254×1254 | 1:1 |
| `in-cinemas-now-1x1.png.png` | 1254×1254 | 1:1 |
| `movie-spotlight-1x1.png.png` | 1254×1254 | 1:1 |
| `new-on-prime-a-1x1.png.png` | 1254×1254 | 1:1 |
| `studio-spotlight-1x1.png.png` | 1254×1254 | 1:1 |
| 8 space-named Netflix/Prime/YouTube files | 1254×1254 | 1:1 |
| `behinde-the-scene-1x1.png.png` | 1122×1402 | **4:5**, not 1:1 |
| `free-on-youtube-1x1.png.png` | 1122×1402 | **4:5**, not 1:1 |
| `this-week-top-rated-1x1.png.png` | 1122×1402 | **4:5**, not 1:1 |
| `today-in-africa-1x1.png.png` | 1122×1402 | **4:5**, not 1:1 |
| `actor-spotlight-a-1x1.png.png` | 1023×1537 | **2:3**, not 1:1 |
| `africa-stories-1x1.png.png` | 1024×1536 | **2:3**, not 1:1 |
| `africa-stories-2-1x1.png.png` | 1024×1536 | **2:3**, not 1:1 |
| `producer-spotlight-1x1.png.png` | 1086×1448 | **3:4**, not 1:1 |

Exact pixel dimensions do not actually matter — the renderer rebuilds these in
satori rather than slicing them, so they serve as visual reference. What matters:

- **2:3 and 3:4 are not supported output formats.** `social_asset_format` allows
  `portrait_4_5`, `square_1_1`, `vertical_9_16`, `landscape_16_9`,
  `video_vertical_9_16`. Those two mockups must be re-cut to a supported ratio,
  or the enum extended by migration.
- The 1:1 mockups are 1254×1254; rendered output is 1080×1080. Proportions carry
  over fine, but do not measure pixel offsets off the mockups.
- Many files carry a doubled `.png.png` extension, and 8 have spaces, a curly
  apostrophe and accented characters in their names. Worth normalising to
  kebab-case before anything references them by path.

## Shared design language

Consistent across every card, so this becomes the base layout:

- Light background, roughly `#F5F3F0` — **not** the dark card the placeholder used.
- Two-column split: text left, subject/poster right.
- Top-left: MuviDB logo + `DISCOVER. CREDIT. CELEBRATE.` (periods in orange).
- Top-right: section label + `01` counter, with a short rule under it.
- Eyebrow label in orange, uppercase, letterspaced, with a rule ending in a dot.
- Headline: very heavy condensed uppercase. Line 1 black, line 2 orange.
- Labelled metadata rows, each with an outlined orange icon.
- Decorative film-strip and dotted-grid elements.
- Footer CTA with a circled arrow: `VIEW FULL PROFILE / MuviDB.com`.
- Closing tagline: `EVERY FILM. EVERY CREDIT. EVERY STORY.`

Platform cards swap the accent to the platform's brand colour — Netflix red
`#E50914`, Prime Video blue `#00A8E1` — while MuviDB orange stays on the logo
and secondary marks.

## Data-field mapping (inferred — needs confirmation)

### Actor / Director Spotlight
| Slot | Source |
|---|---|
| Headline | `people.name`, split across lines |
| Role line (`ACTOR • PRODUCER`) | `people.known_for_department` |
| Nationality | `people.nationality` |
| Bio paragraph | `people.bio` — subject to `isUsableCopy()` |
| KNOWN FOR list | `credits` → `films.title`, top 3 by `billing_order` |
| GENRE | `films.genres` across their credits |
| Portrait | `people.photo_url` — **see blocker below** |

### Movie Spotlight / Now Streaming
| Slot | Source |
|---|---|
| Headline | `films.title` |
| Subtitle | `films.tagline` |
| Synopsis | `films.synopsis` — subject to `isUsableCopy()` |
| RELEASE | `films.release_date` / `coming_soon` / `is_in_cinemas` |
| DURATION | `films.runtime_minutes` |
| GENRE | `films.genres` |
| LANGUAGE | `films.languages` |
| STARRING | `credits` → `people.name` |
| DIRECTOR | `credits` where `role` is director |
| Age rating | `films.nfvcb_rating` |
| Poster | `films.poster_url` |
| Platform badge | `films.streaming_links` |

## Actor Spotlight — built 2026-07-31

`buildActorSpotlightCard()` in `api/_lib/social_render.ts` rebuilds
`actor-spotlight-4x5.png` and renders all three formats. Verified against a real
Cloudinary cutout.

Matching the mockup: background, grid rules with the orange node, header lockup,
`ACTOR SPOTLIGHT 01`, eyebrow + rule, three-line name (ink / orange / letterspaced),
role line, nationality marker, bio, KNOWN FOR list, footer CTA, dot matrix,
orange accent shape, bottom-right portrait.

**Headline font is Bebas Neue** (confirmed by the designer, 2026-07-31), bundled
from `@fontsource/bebas-neue` as `api/_lib/fonts/bebas-neue-latin-400-normal.woff`.
It is caps-only and single-weight, so headline strings are upper-cased at the
call site. Being narrow, it needs a larger point size than a normal grotesque to
fill the column — hence the 100/118/132 step-down keyed off the longest word.

Header lockup: the hexagon from `MuviDB Icon.png` plus "MuviDB" set in Outfit
600. `Wordmark.png` is not used, because it bakes in the
"EVERY FILM. EVERY CREDIT" tagline which turns into an unreadable smear at
header size, and the mockups show no tagline there.

Per-format density is required, not optional. The stack is authored for 4:5; at
1:1 it is ~1090px tall in a 1080px canvas and the KNOWN FOR list collides with
the footer CTA. `density` shrinks the headline, the gaps, the bio length and the
title count for the square format.

Known gaps, in priority order:

1. **Portrait is smaller than the mockup's.** The mockup uses a full-length
   studio portrait; `people.photo_url` is usually a head-and-shoulders crop, so
   scaling it to full card height makes it wider than the canvas and it covers
   the text column. It is fitted to the right column instead. Full-length source
   photos would close this gap.
3. **The orange accent floats** rather than tucking behind the subject's
   shoulder, and is a rotated rounded box rather than the authored organic shape.
4. **Not implemented:** the film-reel line art and the vertical
   `DISCOVER. CREDIT. CELEBRATE.` on the right edge.

### Icons — Solar, same set as the app

The cards use **Solar** via `@iconify-json/solar`, already a dependency and the
set used across the whole MuviDB UI (405 `solar:` usages in `src/`).

Satori cannot resolve an icon font or a remote sprite, so icons are inlined as
SVG data URIs. Solar bodies are stroke-based with `currentColor`, which
`iconDataUri()` substitutes for the brand orange.

`icons.json` is 6MB across 7,404 icons — importing it into a Vercel function
would add that to every cold start. Only the icons actually used are extracted,
into the generated `api/_lib/social_icons.ts` (~7KB, 11 icons).

To add an icon, edit `WANTED` in `scripts/generate_social_icons.mjs` and run:

```bash
node scripts/generate_social_icons.mjs
```

Currently extracted: `globe`, `star`, `arrowRight`, `clapperboard`, `users`,
`calendar`, `clock`, `trophy`, `videocamera`, `armchair`, `mask`. The actor card
uses `globe` (nationality) and a circled `arrowRight` (footer CTA); the rest are
staged for the movie, director and platform cards.

### Portrait scale is set by the SOURCE CROP, not by a size multiplier

The cutout pipeline must produce a **1:2 portrait crop**. Full transformation:

```text
e_background_removal/e_trim/c_fill,ar_1:2,g_face
```

Each step matters:

- `e_background_removal` — the cutout. Must be delivered through the
  transformation URL (see the Cloudinary section above).
- `e_trim` — drops transparent padding (846×717 → 731×717 on the test image).
  Without it the subject sits offset by empty pixels.
- `c_fill,ar_1:2,g_face` — re-crops to a tall portrait around the face
  (731×717 → 358×717).

Why this is the whole ballgame: the subject must stay clear of the text column,
so **width is fixed at roughly 630px**. How tall the subject can be is therefore
decided entirely by the source aspect ratio:

| Source crop | Aspect | Max height on a 4:5 card |
|---|---|---|
| Raw `people.photo_url` cutout | ~1:1 | ~630px (47%) |
| `c_fill,ar_2:3,g_face` | 0.67 | ~940px (70%) |
| `c_fill,ar_1:2,g_face` | 0.50 | ~1250px (93%) — matches the mockups |

Increasing a scale factor cannot fix a square source; it just makes the subject
wider until it covers the text. Feed the renderer a tall crop.

Portrait height is also capped at `height - (gridY - 40)` so a tall crop does not
ride up over the `ACTOR SPOTLIGHT 01` header row.

## Decisions taken

- **`DISCOVER. CREDIT. CELEBRATE.` beside the logo is optional** (designer,
  2026-07-31). It appears in the 2:3 mockups but not the 4:5. Use it where there
  is room; do not force it onto every card.
- **Icons come from Solar** (`@iconify-json/solar`), the same set used across the
  rest of the app — 405 `solar:` usages in `src/`. Not a separate icon export.
- **Headline face is Bebas Neue.**

## Open questions

1. **Headline font.** Heavy condensed grotesque — not Syne. Need the name, and
   the `.ttf`/`.otf` file. Body text may be Outfit; confirm.
2. **Icon set.** Outlined orange icons (globe, star, clapperboard, trophy,
   calendar, clock, chair, people). Need these as SVG, or name the icon library.
3. **`01` counter.** Manual campaign number, or auto-increment per content type?
4. **Cast/genre/awards** are not all reliably populated in the DB. Should a card
   drop a row when its data is missing, or fall back to something?

## Blockers to resolve before building

### Cut-out portraits — SOLVED via Cloudinary (verified 2026-07-31)

Both actor cards and the director card use a subject cleanly cut out from its
background. `people.photo_url` holds ordinary photographs **with** backgrounds,
and satori cannot remove them.

Cloudinary's AI Background Removal add-on handles this. Verified end to end
against a real `people.photo_url`, producing a clean RGBA cutout.

**Working recipe** (both steps are required):

1. Signed upload to `/v1_1/<cloud>/image/upload` with `background_removal=cloudinary_ai`.
   Returns immediately with `info.background_removal.cloudinary_ai.status = "pending"`.
2. Poll `/resources/image/upload/<public_id>` until status is `complete`
   (~6s observed).
3. **Deliver via the transformation URL**, not the plain asset URL:
   `https://res.cloudinary.com/<cloud>/image/upload/e_background_removal/<public_id>.png`

Step 3 is the part that is easy to get wrong. The plain asset URL
(`/image/upload/<public_id>.png`) returns a PNG that *has* an alpha channel and
reports `status: complete`, but still contains the original background. Only the
`e_background_removal` transformation URL returns the actual cutout.

**Fetch mode does not work.** `/image/fetch/e_background_removal/<encoded url>`
returns HTTP 400 on every attempt, so the source must be uploaded first; it
cannot be transformed straight off a remote URL.

**Cost and capacity.** All three accounts are on the **Free** plan with 25
credits/month each — 75 total. One background removal registered ≈0.15 credits,
so roughly **165 per account, ~500/month across all three**. Usage reporting
lags (the figure updates daily), so treat that as approximate and re-measure
after a real batch. Rotation across the three clouds is worthwhile because these
are three separate accounts, each with its own quota.

Always `destroy` the uploaded source after downloading the cutout — the free
plan meters storage and objects, and the cutout is stored in Supabase anyway.

### Content types not in the codebase — the scope problem

`SOCIAL_CONTENT_TYPES` is currently `['actor_spotlight', 'upcoming_movie']`.
The delivered mockups imply roughly **nineteen** distinct card types:

| Group | Types implied |
|---|---|
| People | actor spotlight (2 variants), director spotlight, producer spotlight, studio spotlight, birthday spotlight |
| Titles | movie spotlight, upcoming spotlight, in cinemas now, behind the scene |
| Platform | new on Netflix (2), new on Prime (3+), free on YouTube (2) |
| Editorial | africa stories (2), today in africa, this week top rated |

Each new type needs four things: a domain type, a `cardCopy()` branch, a source
loader (`loadActorSpotlightSource()` equivalent), and a `social_templates` row.
`content_type` is a `text` column, not an enum, so **no migration is required**
to add one — it is code plus a seed row.

Editorial types (`today-in-africa`, `this-week-top-rated`, `africa-stories`) are
different in kind: they are multi-title roundups, not a single source entity.
The current schema assumes one `source_entity_id` per content item, so those
need either a nullable source or a separate collection concept.

Build these incrementally. Do not attempt nineteen at once.

### Satori feasibility
Angled poster frames, rotated film strips, gradient fades and platform logos are
mostly achievable, but satori renders a CSS subset and silently ignores what it
does not support. Plan to bake the fixed decorative layer (film strip, dot grid,
background shapes) into a static PNG overlay per format, and let satori place
only text, artwork and icons on top. That is both more faithful and faster.
