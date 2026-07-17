// Single source of truth for streaming-platform metadata + matching logic.
// Used by the homepage "Where to Watch" strip, the /watch/:platform page,
// the streaming rails, and FilmCard/WatchOptions.

// `icon` is the Iconify fallback; `logo` is the real brand logo asset (rendered
// as an <img> when present). Netflix/Prime/YouTube use simple-icons, which are
// already the official brand marks; the Nigerian platforms ship real logos.
export const PLATFORMS = [
  { id: 'netflix',     name: 'Netflix',     icon: 'simple-icons:netflix',    color: '#E50914' },
  { id: 'prime_video', name: 'Prime Video', icon: 'simple-icons:primevideo', color: '#00A8E1' },
  { id: 'youtube',     name: 'YouTube',     icon: 'simple-icons:youtube',    color: '#FF0000' },
  // Showmax removed: the service was discontinued and its catalogue moved to
  // DSTV Africa, so it's no longer a valid "where to watch" destination.
  { id: 'kava',        name: 'Kava',        icon: 'solar:play-circle-bold',  color: '#FF5C00', logo: '/images/platforms/kava.png' },
  { id: 'docuth',      name: 'Docuth',      icon: 'solar:play-stream-bold',  color: '#16A34A', logo: '/images/platforms/docuth.png' },
  { id: 'ebonylife',   name: 'EbonyLife ON Plus', icon: 'solar:play-circle-bold', color: '#800080', logo: '/images/platforms/ebonylife.png' },
  { id: 'circuits',    name: 'Circuits.tv', icon: 'solar:clapperboard-play-bold', color: '#F0532B', logo: '/images/platforms/circuits.png' },
  { id: 'cinema',      name: 'In Cinemas',  icon: 'solar:ticket-bold',       color: '#FF5A1F', isCinema: true },
];

export const getPlatform = (id) => PLATFORMS.find((p) => p.id === id) || null;

// PostgREST `.or()` filter that selects every film available on a platform.
// streaming_links is jsonb, so `->>` key checks work at the DB level — this is
// what makes counts/queries accurate across the full 19k+ catalogue (the client
// film list is capped at Supabase's 1000-row default and undercounts badly).
export function platformFilter(platformId) {
  if (platformId === 'cinema') return 'is_in_cinemas.eq.true';
  // YouTube titles are ingested with a dedicated source value. Keeping this
  // filter direct avoids a slow JSONB OR scan on the catalogue page.
  if (platformId === 'youtube') return 'source.eq.youtube';
  const parts = [`release_type.eq.${platformId}`, `streaming_links->>${platformId}.not.is.null`];
  return parts.join(',');
}

// streaming_links is stored as JSON (object keyed by platform id) — sometimes a string.
export function parseStreamingLinks(film) {
  if (!film) return {};
  let links = {};
  if (typeof film.streaming_links === 'string') {
    try { links = JSON.parse(film.streaming_links); } catch (e) { /* ignore */ }
  } else if (film.streaming_links) {
    links = film.streaming_links;
  }
  return links || {};
}

// Whether a film is available on a given platform id.
export function isFilmOnPlatform(film, platformId) {
  if (!film || !platformId) return false;
  if (platformId === 'cinema') return !!film.is_in_cinemas;
  if (film.release_type === platformId) return true;
  if (platformId === 'youtube' && film.source === 'youtube') return true;
  return !!parseStreamingLinks(film)[platformId];
}

// Resolve the outbound watch URL for a film on a platform (direct link preferred).
export function getWatchUrl(film, platformId) {
  if (!film) return null;
  const links = parseStreamingLinks(film);
  if (links[platformId]) return links[platformId];
  if (film.release_type === platformId && film.youtube_watch_url) return film.youtube_watch_url;
  return null;
}
