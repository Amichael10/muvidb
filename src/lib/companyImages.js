/**
 * Company logo helpers.
 *
 * Empty-state rule: never invent a logo_url in the DB. Missing logos use the
 * branded building placeholder at display time only so "has logo" filters stay
 * accurate.
 */

export const COMPANY_PLACEHOLDER = '/images/company-placeholder.png';

/** True logo URL only — does not fall back to the placeholder. */
export function getCompanyLogoStrict(company) {
  if (!company) return null;
  const url = company.logo_url || company.logo || null;
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === COMPANY_PLACEHOLDER) return null;
  return trimmed;
}

/** Display logo — real logo, or branded empty-state placeholder. */
export function getCompanyLogo(company) {
  return getCompanyLogoStrict(company) || COMPANY_PLACEHOLDER;
}

export function isCompanyPlaceholder(url) {
  return !url || url === COMPANY_PLACEHOLDER;
}
