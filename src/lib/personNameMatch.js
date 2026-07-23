// Shared person-name matching for credit extractor / admin link flows.
// Handles exact match, name-order swaps ("Adekola Odunlade" ↔ "Odunlade Adekola"),
// and loose search candidates for typeahead.

const PERSON_NOISE = new Set([
  'actor', 'actress', 'alhaji', 'alhaja', 'chief', 'comedian', 'director',
  'dr', 'engr', 'evangelist', 'hon', 'mr', 'mrs', 'ms', 'pastor', 'prince',
  'princess', 'producer', 'sir', 'official', 'and',
]);

export function foldPersonText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘`]/g, "'")
    .toLowerCase();
}

export function personNameTokens(name) {
  return foldPersonText(name)
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !PERSON_NOISE.has(t));
}

/** Multiset key so token order doesn't matter. Null if fewer than 2 real tokens. */
export function sortedNameKey(name) {
  const tokens = personNameTokens(name);
  if (tokens.length < 2) return null;
  return `${tokens.length}:${[...tokens].sort().join('|')}`;
}

export function namesLookSame(a, b) {
  if (!a || !b) return false;
  if (foldPersonText(a) === foldPersonText(b)) return true;
  const ka = sortedNameKey(a);
  const kb = sortedNameKey(b);
  return Boolean(ka && kb && ka === kb);
}

/** Prefer richer / more-credited people when several candidates match. */
export function rankPersonMatch(a, b) {
  const films = Number(b.film_count || 0) - Number(a.film_count || 0);
  if (films) return films;
  const photo = Number(Boolean(b.photo_url)) - Number(Boolean(a.photo_url));
  if (photo) return photo;
  return String(a.name || '').localeCompare(String(b.name || ''));
}

/**
 * Pick the best auto-link from a candidate list for a typed/OCR name.
 * Exact (case-insensitive) wins, then token-order swap, else null.
 */
export function pickAutoMatch(query, candidates = []) {
  const q = String(query || '').trim();
  if (!q || !candidates.length) return null;

  const qFold = foldPersonText(q);
  const exact = candidates.filter((p) => foldPersonText(p.name) === qFold);
  if (exact.length) {
    return [...exact].sort(rankPersonMatch)[0];
  }

  const qKey = sortedNameKey(q);
  if (!qKey) return null;

  const swaps = candidates.filter((p) => sortedNameKey(p.name) === qKey);
  if (!swaps.length) return null;
  return [...swaps].sort(rankPersonMatch)[0];
}
