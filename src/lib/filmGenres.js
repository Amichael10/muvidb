export const CORE_FILM_GENRE_NAMES = [
  'Action', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Family',
  'Horror', 'Mystery', 'Romance', 'Suspense', 'Thriller', 'Animation',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') return String(value.id || value.name || '').trim();
  return '';
}

/** Resolve legacy genre names and current UUID values to canonical genre rows. */
export function resolveFilmGenreSelection(selection, availableGenres) {
  const options = Array.isArray(availableGenres) ? availableGenres : [];
  const byId = new Map(options.map((genre) => [String(genre.id).toLowerCase(), genre]));
  const byName = new Map(options.map((genre) => [String(genre.name).trim().toLowerCase(), genre]));
  const resolved = [];
  const unresolved = [];

  for (const rawValue of Array.isArray(selection) ? selection : []) {
    const value = text(rawValue);
    if (!value) continue;
    const genre = UUID_PATTERN.test(value) ? byId.get(value.toLowerCase()) : byName.get(value.toLowerCase());
    if (genre && !resolved.some((entry) => entry.id === genre.id)) resolved.push(genre);
    else if (!genre && !unresolved.includes(value)) unresolved.push(value);
  }

  return {
    ids: resolved.map((genre) => genre.id),
    names: resolved.map((genre) => genre.name),
    unresolved,
  };
}

export function visibleFilmGenres(availableGenres, selectedIds, expanded) {
  const options = Array.isArray(availableGenres) ? availableGenres : [];
  if (expanded) return options;
  const core = new Set(CORE_FILM_GENRE_NAMES.map((name) => name.toLowerCase()));
  const selected = new Set(Array.isArray(selectedIds) ? selectedIds : []);
  return options.filter((genre) => core.has(String(genre.name).toLowerCase()) || selected.has(genre.id));
}
