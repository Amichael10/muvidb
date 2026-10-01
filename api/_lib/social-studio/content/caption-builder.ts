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
  x: { captionLimit: 280, hashtagLimit: 3, usesTitle: false },
  youtube: { captionLimit: 5000, hashtagLimit: 15, usesTitle: true },
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

export function buildViralNarrative(
  tagline: string | null,
  synopsis: string | null,
  title: string,
  isComingSoon: boolean
): { hookText: string; debateQuestion: string } {
  const usableTagline = firstUsableCopy(tagline);
  const usableSynopsis = firstUsableCopy(synopsis);

  if (usableTagline && usableTagline.length <= 140) {
    const question = deriveDebateQuestion(usableTagline + ' ' + (usableSynopsis || ''), isComingSoon);
    return { hookText: usableTagline, debateQuestion: question };
  }

  if (!usableSynopsis) {
    return {
      hookText: '',
      debateQuestion: isComingSoon
        ? 'Are you seated for this one? Drop a 🍿 if this is on your watchlist! 👇'
        : 'Have you watched this yet? Drop your ratings and honest thoughts below! 👇',
    };
  }

  // Clean raw boilerplate
  const clean = usableSynopsis
    .replace(new RegExp(`^${escapeRegex(title)}\\s*(\\([^)]*\\))?\\s*(is a [^.]+film that\\s*)?(follows|revolves around|tells the story of|centers on|chronicles)\\s+`, 'i'), '')
    .replace(/^(This movie|This film|The story|An upcoming production that|A powerful story that)\s+(follows|revolves around|tells the story of|centers on|is about)\s+/i, '')
    .trim();

  // If already short or teaser-like (e.g. <= 130 chars or already phrased as a question)
  const isAlreadyShortTeaser = clean.length <= 130 || clean.includes('?') || /^(what|how|can|would|when|why)\b/i.test(clean);
  if (isAlreadyShortTeaser) {
    const question = deriveDebateQuestion(clean, isComingSoon);
    return { hookText: clean.charAt(0).toUpperCase() + clean.slice(1), debateQuestion: question };
  }

  // Generate punchy 2-sentence teaser without clunky narrative bulk
  const sentences = clean
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const teaserBody = (sentences.length > 2 ? sentences.slice(0, 2) : sentences).join(' ');
  const capitalized = teaserBody.charAt(0).toUpperCase() + teaserBody.slice(1);
  const question = deriveDebateQuestion(clean, isComingSoon);

  return { hookText: capitalized, debateQuestion: question };
}

function deriveDebateQuestion(text: string, isComingSoon: boolean): string {
  const lower = text.toLowerCase();

  if (/royal|prince|king|palace|throne|monarch/i.test(lower) && /outcast|love|marry|fianc/i.test(lower)) {
    return 'If your family gave you an ultimatum between royal inheritance and true love, which one are you picking?';
  }
  if (/betray|deceit|lies|backstab|secret/i.test(lower)) {
    return 'Can trust ever truly be rebuilt once someone you love betrays you?';
  }
  if (/revenge|vengeance|payback|retribution/i.test(lower)) {
    return 'When pushed to the absolute edge, how far is too far for revenge?';
  }
  if (/money|greed|wealth|inherit|heir|property/i.test(lower)) {
    return 'Does money expose who people truly are, or does it change them?';
  }
  if (/crime|cop|detective|underworld|gang|cartel/i.test(lower)) {
    return 'In a world where one wrong move could cost your life, who can you really trust?';
  }
  if (/marriage|husband|wife|affair|cheat|infidelity/i.test(lower)) {
    return 'What is the one thing you could never forgive in a relationship?';
  }
  if (/mother|father|family|daughter|son|brother|sister/i.test(lower)) {
    return 'How far should family loyalty go when someone crosses the line?';
  }

  return isComingSoon
    ? 'Are you adding this to your watchlist? Tell us what you think of the premise below! 👇'
    : 'If you were in their shoes, what would your next move be? Sound off below! 👇';
}

export function buildMovieHook(tagline: string | null, synopsis: string | null, title: string): string {
  const { hookText } = buildViralNarrative(tagline, synopsis, title, false);
  return hookText;
}

function formatCastList(cast: SnapshotCastMember[], platform: SocialPlatform): string {
  if (!cast.length) return '';
  const handlesOrNames = cast.map(c => (platform === 'instagram' ? c.handle : platform === 'tiktok' ? c.tiktokHandle : null) || c.name);
  return `Starring:\n${handlesOrNames.join('\n')}`;
}

function formatCrewList(credits: SnapshotCreditedPerson[], platform: SocialPlatform, maxCrew = 5): string {
  const crew = credits.filter(credit => credit.role !== 'actor');
  if (!crew.length) return '';
  const prioritizedRoles = ['director', 'producer', 'writer', 'screenplay', 'cinematographer', 'director_of_photography', 'editor', 'sound', 'composer'];
  const sortedCrew = [...crew].sort((a, b) => {
    const aIdx = prioritizedRoles.indexOf(a.role.toLowerCase());
    const bIdx = prioritizedRoles.indexOf(b.role.toLowerCase());
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return 0;
  });
  const picked = sortedCrew.slice(0, maxCrew);
  return `Crew:\n${picked.map(credit => `${credit.role.replace(/_/g, ' ')} — ${(platform === 'instagram' ? credit.instagramHandle : platform === 'tiktok' ? credit.tiktokHandle : null) || credit.name}`).join('\n')}`;
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

function movieBody(snapshot: UpcomingMovieSnapshot, platform: SocialPlatform): string[] {
  const lines: string[] = [];
  const yearSuffix = snapshot.year ? ` (${snapshot.year})` : '';

  // 1. Engaging Announcement Header
  lines.push(
    snapshot.comingSoon
      ? `New Look at ${snapshot.title}${yearSuffix} 🎬`
      : `${snapshot.title}${yearSuffix} 🎬`
  );

  // 2. Watch Platform / Where to Watch line
  if (snapshot.watchAvailability) {
    lines.push(snapshot.watchAvailability.startsWith('Where to Watch') ? snapshot.watchAvailability : `Where to Watch: ${snapshot.watchAvailability}`);
  } else if (snapshot.releaseDate) {
    lines.push(snapshot.comingSoon ? `Coming Soon • ${snapshot.releaseDate} 🍿` : `Released ${snapshot.releaseDate} 🍿`);
  }

  // 3. Punchy narrative teaser / viral hook (NOT dry textbook synopsis!)
  const { hookText, debateQuestion } = buildViralNarrative(snapshot.tagline, snapshot.synopsis, snapshot.title, Boolean(snapshot.comingSoon));
  if (hookText) {
    lines.push(hookText);
  }

  // 4. Starring line-by-line with direct @handles (5-6 cast members)
  const castBlock = formatCastList(snapshot.topCast.slice(0, 6), platform);
  if (castBlock) {
    lines.push(castBlock);
  }

  // 5. Crew line-by-line (4-5 main crew)
  const crewBlock = formatCrewList(snapshot.creditedPeople || [], platform, 5);
  if (crewBlock) {
    lines.push(crewBlock);
  }

  // 6. High-engagement question CTA to spark comments
  const cta = debateQuestion.endsWith('👇') ? debateQuestion : `${debateQuestion} Drop your thoughts below! 👇`;
  lines.push(cta);

  return lines;
}

function criticsBody(snapshot: UpcomingMovieSnapshot): string[] {
  const review = snapshot.criticReview;
  const critic = review?.criticName || 'our critics';
  const quote = review?.quote?.trim();
  return [
    `Hear what ${critic} thinks about ${snapshot.title} 🎬`,
    quote ? `“${quote}”` : 'A fresh critic take on the performances, story, and craft.',
    'Do you agree with this verdict? Share your take below 👇',
  ];
}

function theatreBody(snapshot: TheatrePlaySnapshot, platform: SocialPlatform = 'instagram'): string[] {
  const lines: string[] = [];
  const location = [snapshot.venue, snapshot.city].filter(Boolean).join(', ') || 'Venue TBA';
  
  // 1. Title Header
  lines.push(`${snapshot.title} 🎭 (Upcoming Live Stage Production)`);

  // 2. Time & Date & Venue
  const dateParts: string[] = [];
  if (snapshot.runStartDate || snapshot.runEndDate) {
    const start = snapshot.runStartDate || '';
    const end = snapshot.runEndDate && snapshot.runEndDate !== snapshot.runStartDate ? ` – ${snapshot.runEndDate}` : '';
    dateParts.push(`📅 Dates: ${start}${end}`);
  }
  if (snapshot.performanceTime) {
    dateParts.push(`⏰ Time: ${snapshot.performanceTime}`);
  }
  dateParts.push(`📍 Venue: ${location}`);
  lines.push(dateParts.join('\n'));

  // 3. Punchy Viral Stage Hook
  const { hookText, debateQuestion } = buildViralNarrative(null, snapshot.synopsis, snapshot.title, true);
  if (hookText) {
    lines.push(hookText);
  }

  // 4. Cast (5-6 cast if available)
  if (snapshot.topCast && snapshot.topCast.length > 0) {
    const castBlock = formatCastList(snapshot.topCast.slice(0, 6), platform);
    if (castBlock) lines.push(castBlock);
  }

  // 5. Crew (Playwright, Director, Producer, or stage crew)
  const crewLines: string[] = [];
  if (snapshot.playwright) crewLines.push(`Playwright — ${snapshot.playwright}`);
  if (snapshot.director) crewLines.push(`Director — ${snapshot.director}`);
  if (snapshot.producer) crewLines.push(`Producer — ${snapshot.producer}`);
  if (snapshot.creditedPeople && snapshot.creditedPeople.length > 0) {
    const otherCrew = snapshot.creditedPeople.filter(c => c.role !== 'actor' && c.name !== snapshot.director && c.name !== snapshot.playwright && c.name !== snapshot.producer);
    for (const c of otherCrew.slice(0, 3)) {
      crewLines.push(`${c.role.replace(/_/g, ' ')} — ${(platform === 'instagram' ? c.instagramHandle : platform === 'tiktok' ? c.tiktokHandle : null) || c.name}`);
    }
  }
  if (crewLines.length > 0) {
    lines.push(`Crew:\n${crewLines.slice(0, 5).join('\n')}`);
  }

  // 6. Where to purchase tickets
  const ticketLine = snapshot.ticketUrl
    ? `🎟️ Where to Purchase Tickets:\nGet tickets here: ${snapshot.ticketUrl}`
    : '🎟️ Where to Purchase Tickets:\nTickets available via link in bio / visit MuviDB';
  lines.push(ticketLine);

  // 7. CTA
  const cta = debateQuestion.includes('seated') || debateQuestion.includes('ticket')
    ? debateQuestion
    : `${debateQuestion} Save the date and tell us who you are going with! 👇`;
  lines.push(cta);

  return lines;
}

function baseHashtags(snapshot: SocialSourceSnapshot): (string | null)[] {
  if (snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight') {
    return [
      'MuviDB',
      toHashtag(snapshot.name),
      snapshot.kind === 'birthday_spotlight' ? 'HappyBirthday' : 'ActorSpotlight',
      snapshot.nationality ? toHashtag(snapshot.nationality) : null,
      ...snapshot.knownFor.map(film => toHashtag(film.title)),
      'Nollywood',
    ];
  }

  if (snapshot.kind === 'whats_on_stage') {
    return [
      'MuviDB',
      toHashtag(snapshot.title),
      'Theatre',
      'NigerianTheatre',
      snapshot.city ? toHashtag(snapshot.city) : null,
      'Nollywood',
    ];
  }

  return [
    'MuviDB',
    toHashtag(snapshot.title),
    snapshot.comingSoon ? 'ComingSoon' : 'NowShowing',
    ...snapshot.genres.map(genre => toHashtag(genre)),
    ...snapshot.topCast.map(member => toHashtag(member.name)),
    'Nollywood',
  ];
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
          ? theatreBody(input.snapshot, input.platform)
          : input.snapshot.kind === 'upcoming_movie' && input.snapshot.criticReview
            ? criticsBody(input.snapshot)
            : movieBody(input.snapshot, input.platform);
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
