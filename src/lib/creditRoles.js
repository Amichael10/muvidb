// The credit role vocabulary, shared by the film drawer (AdminFilms) and the
// add-credit flow on the person drawer (AdminPeople). It lived inline in
// AdminFilms as a hardcoded <select>; both screens write to the same
// credits.role column, so a single list is the only way they stay in step.
//
// Roles are stored LOWERCASE and rendered Sentence case by formatRole(). A
// trigger (20260717122831_normalize_credit_roles.sql) lowercases on write, so
// every reader can compare against the plain lowercase value.

export const CAST_ROLE = 'actor';

export const CREW_ROLES = [
  { value: 'director', label: 'Director' },
  { value: 'producer', label: 'Producer' },
  { value: 'executive producer', label: 'Executive producer' },
  { value: 'writer', label: 'Writer' },
  { value: 'cinematographer', label: 'Cinematographer (DOP)' },
  { value: 'editor', label: 'Editor' },
  { value: 'composer', label: 'Composer (music)' },
  { value: 'sound recordist', label: 'Sound recordist' },
  { value: 'production designer', label: 'Production designer' },
  { value: 'art director', label: 'Art director' },
  { value: 'makeup artist', label: 'Makeup artist' },
  { value: 'costume designer', label: 'Costume designer' },
  { value: 'gaffer', label: 'Gaffer' },
  { value: 'continuity', label: 'Continuity' },
  { value: 'production manager', label: 'Production manager' },
  { value: 'assistant director', label: 'Assistant director' },
  { value: 'colorist', label: 'Colorist' },
  { value: 'vfx', label: 'VFX' },
  { value: 'stunts', label: 'Stunts' },
  { value: 'casting director', label: 'Casting director' },
  { value: 'location manager', label: 'Location manager' },
];

// Every role the film drawer's <select> offers, cast first.
export const ALL_ROLES = [{ value: CAST_ROLE, label: 'Actor' }, ...CREW_ROLES];

export function normalizeRole(role) {
  return (role || '').trim().toLowerCase();
}

export function isCastRole(role) {
  return normalizeRole(role) === CAST_ROLE;
}

// Stored lowercase, shown Sentence case. Known roles use their label so
// acronyms survive (a naive capitalise would render "vfx" as "Vfx" and
// "cinematographer (dop)" as "Cinematographer (Dop)"). Anything else — custom
// roles, legacy rows — just gets its first letter raised.
const LABEL_BY_VALUE = new Map(
  [{ value: CAST_ROLE, label: 'Actor' }, ...CREW_ROLES].map((r) => [r.value, r.label]),
);

export function formatRole(role) {
  const key = normalizeRole(role);
  if (!key) return '';
  const known = LABEL_BY_VALUE.get(key);
  if (known) return known;
  // Dotted initialisms ("d.o.p.", "b.t.s", "p.a") are acronyms — sentence case
  // would render "D.o.p.". Legacy rows only; the canonical value for these is
  // 'cinematographer'.
  if (/^[a-z](\.[a-z])+\.?$/.test(key)) return key.toUpperCase();
  return key.charAt(0).toUpperCase() + key.slice(1);
}
