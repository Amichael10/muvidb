// Helpers for the admin Instagram outreach desk.

const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || 'https://muvidb.com').replace(/\/$/, '');

export const DEFAULT_OUTREACH_TEMPLATE = `Hi {first_name} 👋
I came across your work while we were documenting cast and credits, and I realised you already have quite a body of work behind you.
We’re building MuviDB to properly document African films and the people who make them, especially work that often gets missed because it lives on YouTube and other platforms.
We’ve started putting your filmography together here: {profile_url}
If you notice anything missing or incorrect, I’d genuinely love for you to tell us. You can also claim the page whenever you want, which lets you update your photo and profile directly: {claim_url}
Keep going. We’re looking forward to documenting more of your work 🎬`;

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
