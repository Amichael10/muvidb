export const PROFESSIONAL_ROLES = [
  { value: 'actor', label: 'Actor' },
  { value: 'director', label: 'Director' },
  { value: 'producer', label: 'Producer' },
  { value: 'writer', label: 'Writer' },
  { value: 'cinematographer', label: 'Cinematographer' },
  { value: 'editor', label: 'Editor' },
  { value: 'composer', label: 'Composer' },
  { value: 'costume_designer', label: 'Costume Designer' },
  { value: 'production_designer', label: 'Production Designer' },
  { value: 'other', label: 'Other' },
];

export function professionalRoleLabel(value) {
  return PROFESSIONAL_ROLES.find((role) => role.value === value)?.label
    || String(value || '').replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}
