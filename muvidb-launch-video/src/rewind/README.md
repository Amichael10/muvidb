# MuviDB Rewind 2026 — video and stills

Three compositions driving the year-end recap each eligible actor shares.
Ported from `docs/rewind/rewind-sample-template.html`, which stays the source
of truth for layout, copy, colour and timing.

| Composition   | Kind  | Size        | Notes                                   |
| ------------- | ----- | ----------- | --------------------------------------- |
| `RewindVideo` | video | 1080×1920   | 30 fps, 420 frames = 14.0s, no audio    |
| `RewindStory` | still | 1080×1920   | the settled final card                  |
| `RewindFeed`  | still | 1080×1350   | the same card recomposed for 4:5        |

All three take a single prop, `row`, which is one row of `public.rewind_2026`.

## Why this lives here and not in `packages/rewind`

The brief asked for a standalone Remotion project. This repo has no
`packages/` directory, already carries a Remotion project pinned to the version
we need, and the machine it was built on had under 2 GB free — a second
`node_modules` would not fit, before counting the scratch space a render wants.
So it follows this project's own precedent: `src/actor-alert/` is a separate
deliverable living inside the same project, registered through `src/Root.tsx`
the same way.

## Running it

```bash
npm run rewind:studio                    # all three, with placeholder props
npm run rewind:video                     # MP4 with the flags below
npm run rewind:story
npm run rewind:feed
```

Render flags matter and are baked into `rewind:video`:

- `--image-format=png` — the project sets `Config.setVideoImageFormat("jpeg")`
  globally, which makes ffmpeg emit **yuvj420p** (full-range). PNG frames give
  the `yuv420p` the brief asks for.
- `--muted` — Remotion otherwise writes a silent AAC track, which also stretches
  the container from 14.00s to 14.06s.

To render a real actor, pass a row as props:

```bash
npx remotion still RewindVideo out/frame.png --frame=405 --props=row.json
```

## The sequence

| Time        | Scene        | What happens                                     |
| ----------- | ------------ | ------------------------------------------------ |
| 0.0–2.4s    | Hook         | name slides up under "Your 2026 in Nollywood"    |
| 2.4–5.4s    | Poster burst | real posters stack while the film count ticks    |
| 5.4–8.4s    | Hero number  | total views count up on full orange              |
| 8.4–11.0s   | Type reveal  | archetype slams in on an orange bar              |
| 11.0–14.0s  | Final card   | card drops in, settles by 12.0s, holds 2.0s      |

Scene changes are a 0.4s upward wipe. Scenes are stacked absolutely rather than
sequenced, because scene N must stay visible underneath while N+1 wipes over it.

## What real data forced

The reference was built on sample values. These are the places it had to bend:

- **Names are measured, not assumed.** The reference sets the name at a hard
  250px; real names reach 38 characters. `@remotion/layout-utils` measures the
  actual glyphs and `fitTextOnNLines` picks the size and the line break.
- **Fonts are gated.** `@fontsource` registers `@font-face` lazily, so the first
  `measureText()` ran against the fallback. `FontGate` holds the frame until
  Anton and DM Sans are really loaded; `validateFontIsLoaded` keeps that honest.
- **The poster burst adapts.** Dealing 3 posters across the reference's full
  2.2s crawls, so the ramp shortens with the deck and the count pulses once the
  deck is complete.
- **A dead poster cannot kill a render.** `SafePoster` degrades a 404 to a
  branded tile. Across 782 actors that is not hypothetical: 729 films still hold
  a newline inside `poster_url`, and third-party hosts come and go.
- **Everything absent is omitted**, never blanked: portrait, lead/supporting
  pills, each stat row, the archetype band, the Top-N badge.

## Known data problems the template cannot fix

- Some `people.photo_url` values are film posters rather than portraits, so the
  card's portrait slot occasionally shows artwork.
- Some posters are YouTube thumbnails with black bars baked into the image.
  `objectFit: cover` crops them as well as anything can.

## Rendering the whole cohort

`scripts/rewind-render.ts` in the repo root drives this project as a child
process. It bundles **once per run** from `src/rewind-entry.ts` — not the
default entry — because `src/index.ts` also registers the actor-alert
compositions, whose `@remotion/google-fonts` calls fetch ~100 files from
fonts.gstatic.com on every single render. That CDN killed 2 of 3 actors in a
test batch while their own renders were fine; from the isolated entry, both
rendered.

```bash
npx tsx scripts/rewind-render.ts --dry-run            # list, change nothing
npx tsx scripts/rewind-render.ts --slug maurice-sam   # one actor
npx tsx scripts/rewind-render.ts --limit 50           # a batch
npx tsx scripts/rewind-render.ts --shard 3/8          # one stripe of a full pass
```

Measured throughput is **165–350s per actor** (one 14s encode plus two 1080p
stills, each its own browser launch; the spread is poster download time). Budget
accordingly: a 6-hour GitHub job fits roughly 60–100 actors, so a full pass over
780 actors needs either repeated `--limit` runs or `--shard` across parallel ones.
