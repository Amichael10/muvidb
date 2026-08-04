# Film images (poster & backdrop)

## Poster → backdrop fallback

**Rule:** Any film with a `poster_url` and no `backdrop_url` must use the poster as its backdrop everywhere.

Many Nollywood streaming sources (including NolliStream) only provide a poster/thumbnail. Blank hero banners look broken, so we never leave backdrop empty when a poster exists.

### Where it applies

1. **UI display** — `getFilmBackdrop(film)` in `src/lib/filmImages.js` (used by film detail, cards, hero, quick view).
2. **Writes / syncs** — `resolveFilmImageFields({ poster_url, backdrop_url })` before insert/update (admin save, NolliStream sync, scrapers).
3. Prefer a one-off scratch script for bulk backfill of existing rows where `poster_url` is set and `backdrop_url` is null.

### Do not

- Invent a second image download just to fill backdrop when the poster already works.
- Clear `backdrop_url` when it intentionally matches the poster.

---

## Empty poster / backdrop placeholder

**Rule:** Films with no poster and no backdrop show the branded asset at `/images/film-placeholder.webp` at display time only.

- Helpers: `getFilmPoster` / `getFilmBackdrop` (display), `getFilmPosterStrict` / `getFilmBackdropStrict` (real URLs only).
- `ImageWithFallback` with `fallbackType="film"`.
- Never write the placeholder into `poster_url` / `backdrop_url` (keeps “has poster” filters accurate).
- Broken existing poster URLs still fall back to gradient chrome — they are not replaced by the placeholder.
- Channel banners keep `fallbackType="banner"` (gradient), not the film placeholder.

---

## NolliStream

Official platform id: `nollistream`  
Watch URLs: `https://nollistream.net/movie/{id}` stored in `films.streaming_links.nollistream`.

Sync:

```bash
# Preferred — Playwright DOM + search sweep (opens a browser)
npm run sync:nollistream:dom

# API-only (no browser)
npm run sync:nollistream
```

Needs `NOLLISTREAM_EMAIL` / `NOLLISTREAM_PASSWORD` in `.env.local`.

Optional flags:

```bash
npm run sync:nollistream:dom -- --dry-run
npm run sync:nollistream:dom -- --manual-login   # you sign in in the window
npm run sync:nollistream:dom -- --headless
```

Cast/director names arrive as plain text and are resolved into people/credits via `upsert_person_by_name`. Trailers/promos/tests are skipped. Thumbnails are posters only — backdrop follows the poster→backdrop rule above.
