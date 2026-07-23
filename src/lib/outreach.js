// Helpers for the admin Instagram outreach desk.

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');

export const DEFAULT_OUTREACH_TEMPLATE = `Hi {first_name},

We're building MuviDB — a home for African film and the people who make it — and I'd love to introduce it to you.

We've created your public profile with a direct share link that covers your journey:
{profile_url}

Please take a look and let us know if we missed any information, or if there's anything you'd like us to change (for example your photo or bio). We're still fact-checking data, so credits may not be fully up to date yet.

Looking forward to hearing from you.`;

export const OUTREACH_STATUSES = [
  { id: 'pending', label: 'Not contacted', tone: 'muted' },
  { id: 'queued', label: 'Queued', tone: 'amber' },
  { id: 'sent', label: 'Sent', tone: 'blue' },
  { id: 'replied', label: 'Replied', tone: 'green' },
  { id: 'skipped', label: 'Skipped', tone: 'muted' },
];

/** Extract Instagram username from a URL or @handle. */
export function parseInstagramHandle(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^@/, '')
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^instagram\.com\//i, '')
    .split(/[/?#]/)[0]
    .trim();
  if (!cleaned || /^(p|reel|reels|stories|explore|accounts)$/i.test(cleaned)) return null;
  return cleaned;
}

export function instagramProfileUrl(handleOrUrl) {
  const handle = parseInstagramHandle(handleOrUrl);
  return handle ? `https://instagram.com/${handle}` : null;
}

/** Opens Instagram DM compose when possible (mobile / IG app). */
export function instagramDmUrl(handleOrUrl) {
  const handle = parseInstagramHandle(handleOrUrl);
  return handle ? `https://ig.me/m/${handle}` : null;
}

export function personProfileUrl(person) {
  const slug = person?.slug || person?.id;
  if (!slug) return SITE_URL;
  return `${SITE_URL}/people/${slug}`;
}

export function firstNameFromPerson(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return parts[0] || 'there';
}

export function fillOutreachTemplate(template, person) {
  const first = firstNameFromPerson(person?.name);
  const profile = personProfileUrl(person);
  const handle = parseInstagramHandle(person?.instagram_url) || '';
  return String(template || '')
    .replaceAll('{first_name}', first)
    .replaceAll('{name}', person?.name || first)
    .replaceAll('{profile_url}', profile)
    .replaceAll('{instagram}', handle ? `@${handle}` : '');
}
