import type { SocialPlatform } from '../domain/platform-types';
import type { ActorSpotlightSnapshot, BirthdaySpotlightSnapshot, SocialSourceSnapshot, UpcomingMovieSnapshot } from './snapshots';
import { firstUsableCopy } from './copy-quality';

export type PlatformCaptionLimits = {
  /** Hard character ceiling the platform enforces on the caption body. */
  captionLimit: number;
  /** Maximum hashtags to append. Platform ceilings differ from good practice. */
  hashtagLimit: number;
  /** TikTok is the only surface that carries a separate post title. */
  usesTitle: boolean;
};

export const PLATFORM_CAPTION_LIMITS: Record<SocialPlatform, PlatformCaptionLimits> = {
  instagram: { captionLimit: 2200, hashtagLimit: 12, usesTitle: false },
  facebook: { captionLimit: 2000, hashtagLimit: 4, usesTitle: false },
  threads: { captionLimit: 500, hashtagLimit: 3, usesTitle: false },
  tiktok: { captionLimit: 2200, hashtagLimit: 8, usesTitle: true },
};

export type VariantContent = {
  title: string | null;
  caption: string;
  hashtags: string[];
};

/** `#` is added at render time, so tags are stored bare and deduplicated case-insensitively. */
export function toHashtag(value: string): string | null {
  const cleaned = value
    .normalize('NFKD')
    // Strip combining marks left by NFKD so "Adé" folds to "Ade", not "Ade ".
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .trim();
  if (!cleaned) return null;

  const tag = cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');

  return /^[0-9]/.test(tag) ? null : tag || null;
}

function dedupeHashtags(values: (string | null)[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

/** Truncate on a word boundary so captions never end mid-word. */
export function truncateAtWord(value: string, limit: number): string {
  if (limit <= 0) return '';
  if (value.length <= limit) return value;

  const hard = value.slice(0, limit - 1);
  const lastSpace = hard.lastIndexOf(' ');
  const body = (lastSpace > limit * 0.6 ? hard.slice(0, lastSpace) : hard).replace(/[\s,.;:!-]+$/, '');
  return `${body}…`;
}

function joinTitles(titles: string[]): string {
  if (titles.length <= 1) return titles[0] || '';
  if (titles.length === 2) return `${titles[0]} and ${titles[1]}`;
  return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
}

function actorLead(snapshot: ActorSpotlightSnapshot): string {
  const descriptor = [snapshot.nationality, snapshot.knownForDepartment]
    .map(part => (part || '').trim())
    .filter(Boolean)
    .join(' ');

  return descriptor ? `${snapshot.name} — ${descriptor}.` : `${snapshot.name}.`;
}

function actorBody(snapshot: ActorSpotlightSnapshot): string[] {
  const lines: string[] = [`Spotlight: ${actorLead(snapshot)}`];

  const titles = snapshot.knownFor.map(film => film.title).filter(Boolean);
  if (titles.length) lines.push(`Known for ${joinTitles(titles)}.`);

  const bio = firstUsableCopy(snapshot.bio);
  if (bio) lines.push(bio);

  return lines;
}

/**
 * The age is only stated when it came from a real birth year. Guessing an age
 * for a living person in a published post is worse than omitting it.
 */
function birthdayBody(snapshot: BirthdaySpotlightSnapshot): string[] {
  const lines: string[] = [
    snapshot.age === null
      ? `Happy birthday, ${snapshot.name}!`
      : `Happy birthday, ${snapshot.name} — ${snapshot.age} today!`,
  ];

  if (snapshot.roles.length) lines.push(`${joinTitles(snapshot.roles)}.`);

  const titles = snapshot.knownFor.map(film => film.title).filter(Boolean);
  if (titles.length) lines.push(`Known for ${joinTitles(titles)}.`);

  return lines;
}

function movieBody(snapshot: UpcomingMovieSnapshot): string[] {
  const heading = snapshot.year ? `${snapshot.title} (${snapshot.year})` : snapshot.title;
  const lines: string[] = [snapshot.comingSoon ? `Coming soon: ${heading}` : heading];

  const blurb = firstUsableCopy(snapshot.tagline, snapshot.synopsis);
  if (blurb) lines.push(blurb);

  const cast = snapshot.topCast.map(member => member.name).filter(Boolean);
  if (cast.length) lines.push(`Starring ${joinTitles(cast)}.`);

  return lines;
}

function baseHashtags(snapshot: SocialSourceSnapshot): (string | null)[] {
  const tags: (string | null)[] = ['MuviDB'];

  if (snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight') {
    tags.push(toHashtag(snapshot.name));
    if (snapshot.nationality) tags.push(toHashtag(snapshot.nationality));
    tags.push(...snapshot.knownFor.map(film => toHashtag(film.title)));
    tags.push(snapshot.kind === 'birthday_spotlight' ? 'HappyBirthday' : 'ActorSpotlight');
    return tags;
  }

  tags.push(toHashtag(snapshot.title));
  tags.push(...snapshot.genres.map(genre => toHashtag(genre)));
  tags.push(...snapshot.topCast.map(member => toHashtag(member.name)));
  if (snapshot.comingSoon) tags.push('ComingSoon');
  tags.push('NowShowing');

  return tags;
}

/**
 * Builds the caption for one platform.
 *
 * Threads is far shorter than the rest, so the body is trimmed to whatever the
 * platform allows after reserving room for the hashtag block. Reserving first
 * keeps the tags intact instead of letting a long synopsis push them out.
 */
export function buildVariantContent(input: {
  snapshot: SocialSourceSnapshot;
  platform: SocialPlatform;
}): VariantContent {
  const limits = PLATFORM_CAPTION_LIMITS[input.platform];
  const hashtags = dedupeHashtags(baseHashtags(input.snapshot), limits.hashtagLimit);

  const lines =
    input.snapshot.kind === 'birthday_spotlight'
      ? birthdayBody(input.snapshot)
      : input.snapshot.kind === 'actor_spotlight'
        ? actorBody(input.snapshot)
        : movieBody(input.snapshot);
  const body = lines.filter(Boolean).join('\n\n');

  const hashtagBlock = hashtags.map(tag => `#${tag}`).join(' ');
  const reserved = hashtagBlock ? hashtagBlock.length + 2 : 0;
  const caption = truncateAtWord(body, Math.max(0, limits.captionLimit - reserved));

  const title = limits.usesTitle
    ? truncateAtWord(
        input.snapshot.kind === 'actor_spotlight' || input.snapshot.kind === 'birthday_spotlight'
          ? `Spotlight: ${input.snapshot.name}`
          : input.snapshot.title,
        100,
      )
    : null;

  return { title, caption, hashtags };
}

/** The stored caption plus its hashtag block, i.e. what would actually be posted. */
export function renderFullCaption(content: VariantContent): string {
  const block = content.hashtags.map(tag => `#${tag}`).join(' ');
  return block ? `${content.caption}\n\n${block}` : content.caption;
}
