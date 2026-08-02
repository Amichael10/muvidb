# MuviDB ratings — how scores are calculated

The site shows **one** audience metric on cards and film pages: **`films.liked_percent`** (popcorn “% liked”, 0–100). Everything else either feeds that number or is stored for other uses.

Live math lives in:

- [`api/_lib/rating.ts`](../api/_lib/rating.ts) — TypeScript helpers (curve, shrink, reaction blend)
- SQL: `external_liked_pct`, `score10_liked_pct`, `film_base_liked_percent`, `reaction_liked_blend`, `recompute_film_liked_percent`
- Migrations: `20260718*` / `20260724120000_*` (curve + TMDB/IMDb), `20260802223000_*` + `20260802224000_*` (reactions)

---

## What users see

| UI | Field | Notes |
|----|--------|--------|
| Popcorn % liked | `films.liked_percent` | Single source of truth for browse sort / cards / hero |
| Like / dislike buttons | Counts from `film_reactions` | Thumbs also **blend into** `liked_percent` (dampened) |
| Written reviews | `reviews` | Public comments; **do not** change `liked_percent` today |

Abandoned / secondary fields:

- `films.average_rating` — legacy; not what the UI promotes
- `films.audience_rating` — 0–10 from YouTube comment mining; used as a **base** when TMDB/IMDb are missing
- `films.tmdb_rating` / `films.imdb_rating` — external 0–10 inputs to the base

---

## Pipeline (high level)

```text
TMDB or IMDb ──► Bayesian shrink ──► logistic pctLiked ──► base_liked
YouTube comments ──► sentiment ──► shrink ──► pctLiked ──► base_liked (if no TMDB/IMDb)
film_reactions (likes/dislikes) ─────────────────────────► blend into base
                                                              │
                                                              ▼
                                                     films.liked_percent
```

Priority for **base** (before thumbs):

1. TMDB (`tmdb_rating` + `tmdb_vote_count`)
2. else IMDb (`imdb_rating` + `imdb_vote_count`)
3. else YouTube-mined `audience_rating` (already a shrunk 0–10)
4. else no base (reactions-only path, strict)

---

## Shared curve: `pctLiked(score10)`

Maps a 0–10 quality/sentiment score to 0–100 “% liked”.

- Logistic: midpoint **7.1**, slope **k = 1.15**
- Clamp: **[5, 97]** (nothing is 0% or 100%)

Approximate outputs:

| score (0–10) | % liked |
|--------------|---------|
| 5.0 | ~14% |
| 6.0 | ~22% |
| 7.0 | ~47% |
| 7.7 | ~67% |
| 8.5 | ~83% |

SQL twin: `score10_liked_pct(score)` (logistic only).  
TMDB/IMDb also run Bayesian shrink **before** this curve via `external_liked_pct` / `tmdbLikedPercent`.

---

## TMDB / IMDb → base liked %

1. Bayesian weighted rating toward mean **C = 6.5** with **m = 25** votes:

   `WR = (v·avg + m·C) / (v + m)`

2. `liked_percent_base = pctLiked(WR)` (same as `external_liked_pct` in SQL)

Trigger: `films_set_external_liked` on changes to TMDB/IMDb columns, then blends current reaction counts.

Low vote counts cannot mint a perfect film from one 10/10.

---

## YouTube comment mining → base

Implemented in [`api/_lib/comment_reviews.ts`](../api/_lib/comment_reviews.ts):

1. Pull / classify comments → opinion scores (0–10), criticism kept
2. Likes-weighted mean of opinions
3. `shrinkCommentScore(mean, count)` — prior mean **6.5**, prior weight **6**
4. Store `audience_rating` (= shrunk 0–10) and `audience_rating_count`
5. Call `recompute_film_liked_percent(film_id)` so `liked_percent` = blend(base, reactions)

If TMDB or IMDb exists, that still wins as base; YouTube is the fallback base.

Display rows may also land in `reviews` with `source = 'youtube'`.

---

## User likes / dislikes → blend

Table: `film_reactions` (`like` | `dislike`, one row per user per film).

On insert/update/delete, trigger → `recompute_film_liked_percent`.

### Formula (`reaction_liked_blend`)

```text
n = likes + dislikes
prior = 120          # ghost votes — hard to move
anchor = base_liked  # or 40 if no base
min_no_base = 10     # reactions alone need volume before a % appears

if n == 0:
  return base_liked          # may be null

if base_liked is null and n < 10:
  return null                # no popcorn % yet — earn it

liked_percent = round( (likes + prior * anchor/100) / (n + prior) * 100 )
clamp to [5, 97]
```

Constants in TS: `REACTION_PRIOR_WEIGHT`, `REACTION_NO_BASE_ANCHOR`, `REACTION_MIN_NO_BASE`.

### Example outcomes (approx.)

| Base | Likes | Dislikes | Result |
|------|------:|---------:|--------|
| none | 1 | 0 | **null** (under 10 reactions) |
| none | 9 | 0 | **null** |
| none | 10 | 0 | **~45%** |
| none | 50 | 0 | **~58%** |
| none | 200 | 0 | **~78%** |
| 50% | 1 | 0 | **~50%** (+0) |
| 50% | 10 | 0 | **~54%** |
| 50% | 100 | 20 | **~67%** |

Intent: films **stress for volume**. A single like must not invent a mid-score; high % needs real agreement over many thumbs (and/or a strong external base).

---

## What does *not* affect `liked_percent`

| Signal | Stored where | Affects popcorn %? |
|--------|----------------|--------------------|
| User written review body / stars | `reviews` (`source` user) | No |
| Watchlist | `watchlist` | No |
| Raw like/dislike button counts (display) | counted from `film_reactions` | Counts shown separately; blend is the only rating effect |

---

## Security notes

- Users may only insert/update/delete **their own** `film_reactions` rows (RLS).
- `recompute_film_liked_percent` is `SECURITY DEFINER` and executable by **service_role** (and the reaction trigger). Clients do not need to call it; thumbs write reactions and the trigger updates the film.
- Authenticated users cannot arbitrarily write `films.liked_percent` via normal film update policies.

---

## When to change the curve

Keep SQL and [`api/_lib/rating.ts`](../api/_lib/rating.ts) in lockstep. Prefer a **new** migration that `create or replace`s the SQL functions; do not edit already-applied migrations. Update this doc’s example table when constants change.
