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

## NolliStream

Official platform id: `nollistream`  
Watch URLs: `https://nollistream.net/movie/{id}` stored in `films.streaming_links.nollistream`.

Sync: `npm run sync:nollistream` (needs `NOLLISTREAM_EMAIL` / `NOLLISTREAM_PASSWORD` in `.env.local`).

Cast/director names arrive as plain text and are resolved into people/credits via `upsert_person_by_name`. Trailers are skipped. Thumbnails are posters only — backdrop follows the poster→backdrop rule above.
