/**
 * Film image helpers.
 *
 * Rules (system-wide):
 * 1. If a film has a poster but no backdrop, use the poster as the backdrop.
 * 2. Missing poster/backdrop use the branded film placeholder at display time
 *    only — never write the placeholder into poster_url / backdrop_url.
 *
 * Documented in docs/FILM_IMAGES.md.
 */

export const FILM_PLACEHOLDER = '/images/film-placeholder.webp';

const PLACEHOLDER_PATHS = new Set([FILM_PLACEHOLDER]);

export function isFilmPlaceholder(url) {
  return !url || PLACEHOLDER_PATHS.has(url);
}

/** True poster URL only — does not fall back to the placeholder. */
export function getFilmPosterStrict(film) {
  if (!film) return null;
  const url = film.poster_url || film.poster || null;
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || PLACEHOLDER_PATHS.has(trimmed)) return null;
  return trimmed;
}

/** Display poster — real poster, or branded empty-state placeholder. */
export function getFilmPoster(film) {
  return getFilmPosterStrict(film) || FILM_PLACEHOLDER;
}

/**
 * True backdrop/poster URL only — poster fills missing backdrop, but never
 * invents the branded placeholder.
 */
export function getFilmBackdropStrict(film) {
  if (!film) return null;
  const backdrop = film.backdrop_url || film.backdrop || null;
  if (backdrop && typeof backdrop === 'string') {
    const trimmed = backdrop.trim();
    if (trimmed && !PLACEHOLDER_PATHS.has(trimmed)) return trimmed;
  }
  return getFilmPosterStrict(film);
}

/** Backdrop for UI — poster → backdrop chain, then branded empty-state. */
export function getFilmBackdrop(film) {
  return getFilmBackdropStrict(film) || FILM_PLACEHOLDER;
}

/**
 * Values to persist on write. If backdrop is empty and poster is set, copy
 * poster into backdrop_url so SSR/SEO/DB consumers also get a usable image.
 * Never persist the display placeholder.
 */
export function resolveFilmImageFields({ poster_url, backdrop_url } = {}) {
  let poster = (poster_url || '').trim() || null;
  let backdrop = (backdrop_url || '').trim() || null;
  if (poster && PLACEHOLDER_PATHS.has(poster)) poster = null;
  if (backdrop && PLACEHOLDER_PATHS.has(backdrop)) backdrop = null;
  if (!backdrop && poster) backdrop = poster;
  return { poster_url: poster, backdrop_url: backdrop };
}
