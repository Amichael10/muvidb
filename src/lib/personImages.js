/**
 * Person photo helpers.
 *
 * Empty-state rule: never invent a photo_url in the DB. Missing photos use the
 * branded placeholder at display time only so enrichment / "has photo" signals
 * stay accurate.
 */

export const PERSON_PLACEHOLDER = '/images/person-placeholder.png';

/** True photo URL only — does not fall back to the placeholder. */
export function getPersonPhotoStrict(person) {
  if (!person) return null;
  const url = person.photo_url || person.photo || null;
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === PERSON_PLACEHOLDER) return null;
  return trimmed;
}

/** Display photo — real photo, or branded empty-state placeholder. */
export function getPersonPhoto(person) {
  return getPersonPhotoStrict(person) || PERSON_PLACEHOLDER;
}

export function isPersonPlaceholder(url) {
  return !url || url === PERSON_PLACEHOLDER;
}
