# Credit-roll harvester — handoff (where we stopped)

**Date:** 2026-07-28. Written so another AI/dev can continue without the chat history.

## One-line status

The YouTube-credit-roll harvester's **download path is fixed but UNCONFIRMED** — a fix
was just pushed (`b592efc`) and the very next step is to run one command on the worker
laptop and read the `⏱️` line. Everything downstream (OCR, review) is built but unproven.

## Continuation note (2026-07-28)

Codex ran the immediate diagnostic in `C:\Users\User\Filmdba\lumi` after pulling
`origin/staging` (already up to date). The first run with the old 480p-first
selector picked format `135` and timed out after 900s; it did not produce an
empty stub, but it also did not save frames.

Direct recon showed the same cookies/default `android_vr` client can download a
240p section (`133`), albeit slowly. `web` and `mweb` both returned "Video
unavailable" for this URL. The harvester now prefers `133/134/135/...` and can
still be overridden with `--format=134` or `--format=135`.

Verified run:

```
npx.cmd tsx scripts/harvest_credits.ts --frames-only --film=bceeb358-9bcd-4211-8656-decf3a1f784c --cookies="C:\Users\User\Downloads\Cookies.txt"
```

Result: `tail (300s) = 2.6MB in 215s`, `100 frames saved` to
`harvest_frames\bceeb358-9bcd-4211-8656-decf3a1f784c`. Real visual check:
`f_070.jpg` contains the cast list, and `f_100.jpg` contains the closing credit
card ("DIRECTOR IKECHUKWU NWEKE" / "DESTINY ETIKO PRODUCTIONS"). Download is
confirmed for this film; next work is OCR quality/parsing.

## Git / where the code is

- **All work is on branch `staging`** (remote `origin/staging = b592efc`). **`main` is
  untouched (`235843f`)** and must stay that way — owner rule: experiments on staging,
  do NOT push to `main`, do NOT push anywhere without the owner saying so.
- Local working branch is `feat/harvest-related-language`, pushed to `origin/staging`.
- The worker laptop has the repo cloned at `C:\Users\User\muvidb` on `staging`; it
  `git pull`s to get updates.

## What this feature is

Nollywood YouTube films aren't on IMDB and their descriptions are hashtag spam, so the
**end-of-video credit roll** is the only full cast/crew source. Pipeline:
`yt-dlp downloads the last ~5 min → ffmpeg extracts frames → local OCR (tesseract) →
parse → write to credit_candidates (Supabase) → human approves in admin UI`.

Key files:
- `scripts/harvest_credits.ts` — the headless worker (runs on the spare laptop).
- `supabase/migrations/20260728010500_credit_harvest.sql` — **applied**. Tables:
  `credit_harvest_jobs` (queue), `credit_candidates` (proposals awaiting approval).
- `src/pages/admin/AdminCreditHarvest.jsx` + route `/admin/credits/harvest` — review UI
  (approve/reject/delete, per-row + bulk). Nothing reaches the real `credits` table
  until a human approves.

## THE IMMEDIATE NEXT STEP (do this first)

On the laptop:
```
git pull
npx tsx scripts/harvest_credits.ts --frames-only --film=bceeb358-9bcd-4211-8656-decf3a1f784c --cookies="C:\Users\User\Downloads\Cookies.txt"
```
Read the `⏱️  tail (300s) = X MB in Ys` line:
- **Real MB (e.g. ~11MB) + "N frames saved"** → download is SOLVED. Open
  `harvest_frames\bceeb358...\` and check the LAST frames for the credit roll.
  - Roll visible → move to OCR (below).
  - Only final scene / a "coming soon" advert → roll isn't in the last 5 min; rerun with
    `--tail=480`.
- **Guard fires: "downloaded only N bytes"** → positive timestamps also produce empty;
  deeper issue — download the full chosen format then ffmpeg-trim locally instead of
  using `--download-sections`.

## The download saga (so it isn't re-derived) — LESSONS

Many round-trips were spent here. Confirmed facts:
- **`--download-sections` takes TIMESTAMPS, not percentages.** `*86%-100%` is invalid.
- **Positive timestamps work; the NEGATIVE form (`*-300-inf`) wrote a 262-byte empty
  stub** with these DASH formats. `b592efc` reverted to positive: probe duration, then
  `*<start>-<end>` where start = duration − 300. This is the current, most-likely-correct
  state, but UNRUN.
- **Do NOT bypass yt-dlp with raw ffmpeg on a `-g` URL** — googlevideo needs the
  User-Agent header yt-dlp passes to ffmpeg; a hand-rolled call gets an empty/rejected
  result.
- **Cookies are mandatory and they work.** `yt-dlp --cookies <path> -F <url>` showed ALL
  formats have real https URLs and filesizes — **no DRM, no SABR** for this video.
  Relevant format IDs: `134`=360p avc1, `135`=480p avc1, `133`=240p, `18`=360p
  progressive. The selector prefers avc1 video-only ≤480
  (`bv*[height<=480][vcodec^=avc1]/…`), never a bare `worst` (that resolves to
  audio-only → ffmpeg "Output file does not contain any stream").
- **Clients:** don't force one. `android_vr` (yt-dlp default here) is throttled; `tv` is
  DRM'd; `ios` needs a PO token. Cookies + default client is the working combo. Override
  available via `--client=`.
- **Throttle is still an open question.** Early positive-timestamp downloads were slow
  (~46KB/s via android_vr). A 5-min avc1 tail is ~7–11MB, so even throttled it's ~2–4
  min/film. The `⏱️` line from the next run gives the real number. If too slow at 30k
  scale, the documented escalation is the **bgutil PO-token provider**
  (`docker run … brainicism/bgutil-ytdlp-pot-provider`) to unlock un-throttled web
  formats.

## After frames are confirmed: OCR

- Current code uses **tesseract**. The owner (correctly) prefers **PaddleOCR** — credit
  text over moving footage is exactly where tesseract is weak. Swap is planned; do it once
  frames are confirmed. A `--ocr=` flag + comparing against manually-done films (99% ground
  truth) would settle it empirically.
- Parsing heuristics in `harvest_credits.ts` (`looksLikeName`, role splitting,
  `STOP_MARKERS`, `MIN_ENTRIES` structural gate) are UNTUNED against real Nollywood rolls —
  expect to iterate. `STOP_MARKERS` is the anti-advert guard (discards "coming soon",
  "subscribe", etc. so next-movie promos aren't mined as cast).

## Dataset / localized Nollywood OCR note (2026-07-30)

Owner wants to preserve the option of a localized Nollywood credit-roll extractor later.
Do not jump straight to training OCR. The more realistic path is to build a labeled
credit-layout dataset from the approval lane first.

Capture/keep, when practical:
- frame image or frame crop for the candidate row, especially rejected/edited rows;
- OCR TSV/text with bounding boxes, confidence, frame index, and source video second;
- parser guess: raw name, role/character, actor vs crew, layout mode;
- reviewer decision: approved, rejected, deleted, corrected name, linked person, corrected
  role/character, corrected type;
- reason labels for common failures: subtitle/dialogue, promo/ad, role-as-name,
  name+role merged, actor/character swapped, OCR misspelling, duplicate person.

This gives three future options:
1. improve rule-based parsing from real rejection/approval patterns;
2. train a small line/layout classifier that sits after OCR;
3. only later, if the OCR text itself is the bottleneck, evaluate PaddleOCR/custom OCR on
   the saved Nollywood credit-frame corpus.

Current lesson from `Ife Dun`: loose one-frame harvesting catches fast ensemble cards but
can admit subtitles. The parser now needs credit-card context, not just "two words that
look like a name." Keep examples like this; they are exactly the dataset we need.

## Metadata extraction in the credit harvester (2026-08-04)

The worker now also reads YouTube title/description metadata and writes text-only suggestions into `credit_metadata_candidates`: synopsis, release year, language, NFVCB age rating, and production company. This does not store video/images and does not call a paid LLM. Admin approval from `/admin/credits/harvest` applies the suggestion to `films` and links/creates a production company through `film_companies`.

Actor/person matching on the review page and approval RPC already uses the shared order-insensitive `name_key` flow, so names like `Femi Adebayo` and `Adebayo Femi` resolve to the same existing profile when the tokens match.

## Queue ordering in the credit harvester (2026-08-04)

Worker runs now start from the latest updated published YouTube movie in `films`, then move backward. `--enqueue-sparse` walks YouTube films by `updated_at desc`, all enqueue modes store an updated-at priority, pending jobs refresh when they are requeued, and `claim_credit_harvest_job` only claims pending YouTube-film jobs by that priority. The review pagination RPC uses the same film update timestamp so the admin approval page follows the worker order.

## Worker tools + gotchas (laptop)

- Needs `yt-dlp`, `ffmpeg`, `tesseract` on PATH. PATH only refreshes in a NEW terminal
  after `winget install`. Tesseract (UB-Mannheim) does NOT self-add to PATH.
- `.env.local` (gitignored) holds Supabase keys + optionally `COOKIES_FILE`. A fresh
  clone won't have it — copy it over manually.
- **Disable sleep** before the unattended grind or the laptop stops the job:
  `powercfg /change standby-timeout-ac 0` etc.
- PowerShell 5.1: no `&&` chaining — use `;` or separate lines.

## Enqueue modes (once download+OCR confirmed)

- `--enqueue-sparse` (default <4 credits) — **the main one**: latest-updated published YouTube films that actually
  need enrichment (~33k YouTube films qualify).
- `--enqueue-recon=3` — sample per channel to learn which channels even have rolls.
- `--enqueue-popular=N` — top by views.
- Then `npx tsx scripts/harvest_credits.ts --cookies=<path>` runs the worker loop
  (resumable; `outcome='no_credits'` is a valid result, not a failure).

## Low-coverage second pass (2026-07-30)

Do not discard harvested candidates just because a movie looks incomplete. Requeue the weak
jobs and run an append-only second pass:

```
npx tsx scripts/harvest_credits.ts --requeue-low-coverage=12
npx tsx scripts/harvest_credits.ts --format=18 --frame-every=1 --single-frame-min-ocr=0.65 --reharvest-existing --cookies="C:\Users\User\Downloads\Cookies.txt"
```

`--reharvest-existing` bypasses the old "pending candidates already exist" skip, but it
deduplicates by name + role/character + credit type before inserting. Existing review rows
stay intact; the second pass only appends genuinely new candidates.

## Other work parked on this same branch (NOT yet on main)

`staging` also carries, all local/unmerged, all working-tree-verified but NOT
production-tested:
- **film_related recommender** (migrations applied, 467k rows populated,
  `scripts/build_related_films.ts`, wired into FilmDetail). Needs a scheduled rebuild.
- **African-languages dropdown** on the film edit form.
- **fuzzy people suggestions** (`suggest_similar_people` RPC, migration applied).
- The owner's own pre-existing WIP (commit `511bdbd`).
See `docs/WORK_LOG.md` for those.

## Absolute rules for the next AI

1. **Do not push to `main`.** Staging only. Do not push anywhere unless the owner says so.
2. **Verify by looking at real output, not by assuming** — this saga was prolonged by
   celebrating a "9s download" that was actually a 262-byte empty file. Check bytes,
   check `ffprobe`, check the actual frames.
3. The migrations are on a **shared** Supabase DB — additive changes are fine, destructive
   ones need explicit go-ahead.
