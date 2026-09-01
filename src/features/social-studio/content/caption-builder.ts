import type { SocialPlatform } from '../domain/platform-types.js';
import type { ActorSpotlightSnapshot, BirthdaySpotlightSnapshot, SnapshotCastMember, SnapshotCreditedPerson, SocialSourceSnapshot, TheatrePlaySnapshot, UpcomingMovieSnapshot } from './snapshots.js';
import { firstUsableCopy } from './copy-quality.js';

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

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildMovieHook(tagline: string | null, synopsis: string | null, title: string): string {
  const parts: string[] = [];

  const usableTagline = firstUsableCopy(tagline);
  if (usableTagline) {
    parts.push(usableTagline);
  }

  const usableSynopsis = firstUsableCopy(synopsis);
  if (usableSynopsis) {
    const clean = usableSynopsis
      .replace(new RegExp(`^${escapeRegex(title)}\\s*(\\([^)]*\\))?\\s*(is a [^.]+film that\\s*)?(follows|revolves around|tells the story of|centers on|chronicles)\\s+`, 'i'), '')
      .replace(/^(This movie|This film|The story)\s+(follows|revolves around|tells the story of|centers on|is about)\s+/i, '')
      .trim();

    const capitalized = clean.charAt(0).toUpperCase() + clean.slice(1);
    const sentences = capitalized
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (sentences.length > 0) {
      if (!usableTagline) {
        parts.push(sentences.slice(0, 2).join(' '));
      } else if (sentences[0] && !usableTagline.includes(sentences[0])) {
        parts.push(sentences[0]);
      }
    }
  }

  return parts.filter(Boolean).join('\n\n');
}

function formatCastList(cast: SnapshotCastMember[]): string {
  if (!cast.length) return '';
  const handlesOrNames = cast.map(c => (c.handle ? c.handle : c.name));
  return `Starring:\n${handlesOrNames.join('\n')}`;
}

function formatCrewList(credits: SnapshotCreditedPerson[]): string {
  const crew = credits.filter(credit => credit.role !== 'actor');
  if (!crew.length) return '';
  return `Crew:\n${crew.map(credit => `${credit.role.replace(/_/g, ' ')} — ${credit.instagramHandle}`).join('\n')}`;
}

function actorBody(snapshot: ActorSpotlightSnapshot): string[] {
  const lines: string[] = [];
  const handleOrName = snapshot.handle ? `${snapshot.name} (${snapshot.handle})` : snapshot.name;
  lines.push(`Star Spotlight: ${handleOrName} 🌟`);

  const titles = snapshot.knownFor.map(film => film.title).filter(Boolean);
  if (titles.length) {
    lines.push(`From standout performances in ${joinTitles(titles)}, ${snapshot.name} continues to deliver unforgettable Nollywood cinema.`);
  }

  const bio = firstUsableCopy(snapshot.bio);
  if (bio) {
    lines.push(bio);
  }

  lines.push(`What is your favorite ${snapshot.name} movie of all time? Drop your top picks in the comments! 👇`);
  return lines;
}

function birthdayBody(snapshot: BirthdaySpotlightSnapshot): string[] {
  const lines: string[] = [];
  const handleOrName = snapshot.handle ? `${snapshot.name} (${snapshot.handle})` : snapshot.name;
  lines.push(
    snapshot.age === null
      ? `Happy Birthday to the incredible ${handleOrName}! 🎂🎉✨`
      : `Happy Birthday to the incredible ${handleOrName} — celebrating ${snapshot.age} golden years today! 🎂🎉✨`
  );

  const titles = snapshot.knownFor.map(film => film.title).filter(Boolean);
  if (titles.length) {
    lines.push(`Celebrating a true Nollywood icon known for unforgettable roles in ${joinTitles(titles)}.`);
  }

  lines.push(`Join us in celebrating this star today! Drop your warm birthday wishes and favorite roles below! 🥳👇`);
  return lines;
}

function movieBody(snapshot: UpcomingMovieSnapshot): string[] {
  const lines: string[] = [];
  const yearSuffix = snapshot.year ? ` (${snapshot.year})` : '';

  // 1. Engaging Announcement Header
  lines.push(
    snapshot.comingSoon
      ? `New Look at ${snapshot.title}${yearSuffix} 🎬`
      : `${snapshot.title}${yearSuffix}`
  );

  // 2. Watch Platform / Release Date line
  if (snapshot.watchAvailability) {
    lines.push(snapshot.watchAvailability);
  } else if (snapshot.releaseDate) {
    lines.push(snapshot.comingSoon ? `Coming Soon • ${snapshot.releaseDate} 🍿` : `Released ${snapshot.releaseDate} 🍿`);
  }

  // 3. Punchy narrative teaser / hook (NOT dry textbook synopsis!)
  const hook = buildMovieHook(snapshot.tagline, snapshot.synopsis, snapshot.title);
  if (hook) {
    lines.push(hook);
  }

  // 4. Starring line-by-line with direct @handles
  const castBlock = formatCastList(snapshot.topCast);
  if (castBlock) {
    lines.push(castBlock);
  }

  const crewBlock = formatCrewList(snapshot.creditedPeople || []);
  if (crewBlock) {
    lines.push(crewBlock);
  }

  // 5. High-engagement question CTA to spark comments
  const cta = snapshot.comingSoon
    ? 'Are you seated for this one? Drop a 🍿 if this is on your watchlist! 👇'
    : 'Have you watched this yet? Drop your ratings and thoughts below! 👇';
  lines.push(cta);

  return lines;
}

function theatreBody(snapshot: TheatrePlaySnapshot): string[] {
  const lines: string[] = [];
  const location = [snapshot.venue, snapshot.city].filter(Boolean).join(', ');
  lines.push(`${snapshot.title} is on stage 🎭`);
  if (location) lines.push(location);
  if (snapshot.runStartDate || snapshot.runEndDate) {
    const start = snapshot.runStartDate || '';
    const end = snapshot.runEndDate && snapshot.runEndDate !== snapshot.runStartDate ? ` - ${snapshot.runEndDate}` : '';
    lines.push(`${start}${end}${snapshot.performanceTime ? ` • ${snapshot.performanceTime}` : ''}`);
  } else if (snapshot.performanceTime) {
    lines.push(snapshot.performanceTime);
  }
  const synopsis = firstUsableCopy(snapshot.synopsis);
  if (synopsis) lines.push(synopsis);
  lines.push('Are you seated for this one? Save it and tell us who you are going with.');
  return lines;
}

function baseHashtags(snapshot: SocialSourceSnapshot): (string | null)[] {
  const tags: (string | null)[] = ['Nollywood', 'NollywoodMovies', 'MuviDB'];

  if (snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight') {
    tags.push(toHashtag(snapshot.name));
    if (snapshot.nationality) tags.push(toHashtag(snapshot.nationality));
    tags.push(...snapshot.knownFor.map(film => toHashtag(film.title)));
    tags.push(snapshot.kind === 'birthday_spotlight' ? 'HappyBirthday' : 'ActorSpotlight');
    return tags;
  }

  if (snapshot.kind === 'whats_on_stage') {
    tags.push(toHashtag(snapshot.title), 'Theatre', 'NigerianTheatre');
    if (snapshot.city) tags.push(toHashtag(snapshot.city));
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
        : input.snapshot.kind === 'whats_on_stage'
          ? theatreBody(input.snapshot)
          : movieBody(input.snapshot);
  const body = lines.filter(Boolean).join('\n\n');

  const hashtagBlock = hashtags.map(tag => `#${tag}`).join(' ');
  const reserved = hashtagBlock ? hashtagBlock.length + 2 : 0;
  const caption = truncateAtWord(body, Math.max(0, limits.captionLimit - reserved));

  const title = limits.usesTitle
    ? truncateAtWord(
        input.snapshot.kind === 'actor_spotlight' || input.snapshot.kind === 'birthday_spotlight'
          ? `Spotlight: ${input.snapshot.name}`
          : input.snapshot.kind === 'whats_on_stage'
            ? input.snapshot.title
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
