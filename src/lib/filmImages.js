/**
 * Film image helpers.
 *
 * Rule (system-wide): if a film has a poster but no backdrop, use the poster
 * URL as the backdrop. Many Nigerian platforms only ship posters. Documented in
 * docs/FILM_IMAGES.md.
 */

export function getFilmPoster(film) {
  if (!film) return null;
  return film.poster_url || film.poster || null;
}

/** Backdrop for UI — falls back to poster when backdrop is missing. */
export function getFilmBackdrop(film) {
  if (!film) return null;
  return (
    film.backdrop_url ||
    film.backdrop ||
    film.poster_url ||
    film.poster ||
    null
  );
}

/**
 * Values to persist on write. If backdrop is empty and poster is set, copy
 * poster into backdrop_url so SSR/SEO/DB consumers also get a usable image.
 */
export function resolveFilmImageFields({ poster_url, backdrop_url } = {}) {
  const poster = (poster_url || '').trim() || null;
  let backdrop = (backdrop_url || '').trim() || null;
  if (!backdrop && poster) backdrop = poster;
  return { poster_url: poster, backdrop_url: backdrop };
}
