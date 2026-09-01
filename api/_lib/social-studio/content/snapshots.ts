import type { SocialContentType } from '../domain/content-types.js';
import { firstUsableCopy, isLikelyFilmTitle } from './copy-quality.js';

/**
 * A snapshot is the frozen copy of the source entity at generation time.
 *
 * Social posts are reviewed and scheduled long after they are generated, and
 * `people`/`films` keep changing underneath. Rendering and captions read the
 * snapshot rather than the live row so an approved post cannot silently change
 * between approval and publication.
 */
export type SnapshotKnownForFilm = {
  filmId: string;
  title: string;
  slug: string | null;
  year: number | null;
  posterUrl: string | null;
  character: string | null;
};

export type SnapshotCastMember = {
  personId: string;
  name: string;
  handle: string | null;
  character: string | null;
};

export type SnapshotCreditedPerson = {
  personId: string;
  name: string;
  instagramHandle: string;
  role: string;
  character: string | null;
};

export type ActorSpotlightSnapshot = {
  kind: 'actor_spotlight';
  capturedAt: string;
  personId: string;
  name: string;
  handle: string | null;
  slug: string | null;
  photoUrl: string | null;
  photoCutoutUrl: string | null;
  nationality: string | null;
  knownForDepartment: string | null;
  bio: string | null;
  knownFor: SnapshotKnownForFilm[];
  creditCount: number;
};

export type UpcomingMovieSnapshot = {
  kind: 'upcoming_movie';
  capturedAt: string;
  filmId: string;
  title: string;
  slug: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  releaseDate: string | null;
  watchAvailability: string | null;
  year: number | null;
  synopsis: string | null;
  tagline: string | null;
  genres: string[];
  countries: string[];
  languages: string[];
  likedPercent: number | null;
  comingSoon: boolean;
  isPublished: boolean;
  topCast: SnapshotCastMember[];
  creditedPeople: SnapshotCreditedPerson[];
  youtubeChannelName: string | null;
  youtubeChannelHandle: string | null;
};

export type TheatrePlaySnapshot = {
  kind: 'whats_on_stage';
  capturedAt: string;
  playId: string;
  title: string;
  slug: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  synopsis: string | null;
  venue: string | null;
  city: string | null;
  country: string | null;
  runStartDate: string | null;
  runEndDate: string | null;
  performanceTime: string | null;
  playwright: string | null;
  director: string | null;
  status: string | null;
  year: number | null;
};

/**
 * A birthday post. Structurally the actor card with a different eyebrow and a
 * celebratory line in place of the bio, so it carries the same person fields
 * plus the birthday itself.
 */
export type BirthdaySpotlightSnapshot = Omit<ActorSpotlightSnapshot, 'kind'> & {
  kind: 'birthday_spotlight';
  dateOfBirth: string;
  /** Null when the stored date has no year (some rows carry only month/day). */
  age: number | null;
  /** Display roles for the "ACTOR · PRODUCER" line, derived from credits. */
  roles: string[];
};

export type SocialSourceSnapshot =
  | ActorSpotlightSnapshot
  | BirthdaySpotlightSnapshot
  | UpcomingMovieSnapshot
  | TheatrePlaySnapshot;

export const SOURCE_ENTITY_TYPES: Record<SocialContentType, 'person' | 'film' | 'play'> = {
  actor_spotlight: 'person',
  birthday_spotlight: 'person',
  upcoming_movie: 'film',
  critics_say: 'film',
  where_to_watch: 'film',
  weekend_watchlist: 'film',
  whats_on_stage: 'play',
  film_conversation: 'film',
};

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(text).filter((entry): entry is string => Boolean(entry)))];
}

function integer(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** Only the year is meaningful for display, and release_date is often partial. */
function yearFrom(film: Record<string, any>): number | null {
  const direct = integer(film.year);
  if (direct) return direct;
  const release = text(film.release_date);
  if (!release) return null;
  const parsed = integer(release.slice(0, 4));
  return parsed || null;
}

export function buildActorSpotlightSnapshot(input: {
  person: Record<string, any>;
  credits?: Record<string, any>[];
  capturedAt: string;
  knownForLimit?: number;
}): ActorSpotlightSnapshot {
  const credits = Array.isArray(input.credits) ? input.credits : [];
  const limit = input.knownForLimit ?? 3;

  const knownFor: SnapshotKnownForFilm[] = credits
    .filter(credit => credit?.films?.id && isLikelyFilmTitle(text(credit.films.title)))
    .map(credit => ({
      filmId: String(credit.films.id),
      title: String(text(credit.films.title)),
      slug: text(credit.films.slug),
      year: yearFrom(credit.films),
      posterUrl: text(credit.films.poster_url),
      character: text(credit.character_name),
    }))
    .slice(0, limit);

  return {
    kind: 'actor_spotlight',
    capturedAt: input.capturedAt,
    personId: String(input.person.id),
    name: String(text(input.person.name) || 'Unknown'),
    handle: extractSocialHandle(input.person),
    slug: text(input.person.slug),
    photoUrl: text(input.person.photo_url),
    photoCutoutUrl:
      text(input.person.photo_cutout_status) === 'ready' ? text(input.person.photo_cutout_url) : null,
    nationality: text(input.person.nationality),
    knownForDepartment: text(input.person.known_for_department),
    bio: text(input.person.bio),
    knownFor,
    creditCount: credits.length,
  };
}

/**
 * Age on the captured date. Returns null when the stored value carries no
 * usable year — some rows hold only a month and day, and a birthday card is
 * still valid without an age.
 */
function ageOn(dateOfBirth: string, capturedAt: string): number | null {
  const born = new Date(dateOfBirth);
  const on = new Date(capturedAt);
  if (Number.isNaN(born.getTime()) || Number.isNaN(on.getTime())) return null;
  if (born.getUTCFullYear() < 1900) return null;

  let age = on.getUTCFullYear() - born.getUTCFullYear();
  const monthDelta = on.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getUTCDate() < born.getUTCDate())) age -= 1;

  return age >= 0 && age < 130 ? age : null;
}

/**
 * Roles for the "ACTOR · PRODUCER" line. Ordered by how often the person is
 * credited, so the role they are best known for leads.
 */
function rolesFromCredits(credits: Record<string, any>[]): string[] {
  const counts = new Map<string, number>();

  for (const credit of credits) {
    const role = text(credit?.role);
    if (!role) continue;
    const label = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label]) => label);
}

/**
 * Days from the captured date to the next occurrence of the birthday, ignoring
 * year. 0 means today. Returns null when the date cannot be parsed.
 */
export function daysUntilBirthday(dateOfBirth: string, capturedAt: string): number | null {
  const born = new Date(dateOfBirth);
  const on = new Date(capturedAt);
  if (Number.isNaN(born.getTime()) || Number.isNaN(on.getTime())) return null;

  const today = Date.UTC(on.getUTCFullYear(), on.getUTCMonth(), on.getUTCDate());
  let next = Date.UTC(on.getUTCFullYear(), born.getUTCMonth(), born.getUTCDate());
  if (next < today) next = Date.UTC(on.getUTCFullYear() + 1, born.getUTCMonth(), born.getUTCDate());

  return Math.round((next - today) / 86_400_000);
}

export function extractSocialHandle(person: {
  instagram_url?: string | null;
  twitter_url?: string | null;
  tiktok_url?: string | null;
  youtube_handle?: string | null;
}): string | null {
  if (!person) return null;
  if (person.instagram_url) {
    const clean = String(person.instagram_url).trim().replace(/\/$/, '');
    const match = clean.match(/(?:instagram\.com\/|@)?([a-zA-Z0-9._]+)$/i);
    if (match && match[1] && !['p', 'reel', 'tv', 'stories', 'explore'].includes(match[1].toLowerCase())) {
      return `@${match[1]}`;
    }
  }
  if (person.twitter_url) {
    const clean = String(person.twitter_url).trim().replace(/\/$/, '');
    const match = clean.match(/(?:twitter\.com\/|x\.com\/|@)?([a-zA-Z0-9_]+)$/i);
    if (match && match[1]) return `@${match[1]}`;
  }
  if (person.tiktok_url) {
    const clean = String(person.tiktok_url).trim().replace(/\/$/, '');
    const match = clean.match(/(?:tiktok\.com\/@?|@)?([a-zA-Z0-9._]+)$/i);
    if (match && match[1]) return `@${match[1]}`;
  }
  if (person.youtube_handle) {
    const h = String(person.youtube_handle).trim().replace(/^@/, '');
    if (h) return `@${h}`;
  }
  return null;
}

/** Instagram mentions must come from a stored Instagram URL, never another network's handle. */
export function extractInstagramHandle(person: { instagram_url?: string | null }): string | null {
  if (!person?.instagram_url) return null;
  const clean = String(person.instagram_url)
    .trim()
    .split(/[?#]/, 1)[0]
    .replace(/\/$/, '');
  const match = clean.match(/(?:instagram\.com\/|@)?([a-zA-Z0-9._]+)$/i);
  if (!match?.[1] || ['p', 'reel', 'tv', 'stories', 'explore'].includes(match[1].toLowerCase())) return null;
  return `@${match[1]}`;
}

function formatDateNice(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function formatWatchAvailability(film: {
  is_in_cinemas?: boolean | null;
  coming_soon?: boolean | null;
  release_date?: string | null;
  release_type?: string | null;
  source?: string | null;
  streaming_links?: Record<string, string> | string | null;
  youtube_watch_url?: string | null;
  youtube_channel_name?: string | null;
}): string | null {
  if (!film) return null;
  let links: Record<string, string> = {};
  if (film.streaming_links && typeof film.streaming_links === 'object') {
    links = film.streaming_links;
  } else if (typeof film.streaming_links === 'string') {
    try {
      const parsed = JSON.parse(film.streaming_links);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) links = parsed;
    } catch {
      links = {};
    }
  }

  const displayNames: Record<string, string> = {
    nollistream: 'NolliStream',
    docuth: 'Docuth',
    ebonylife: 'EbonyLife ON Plus',
    kava: 'Kava',
    circuits: 'Circuits.tv',
    netflix: 'Netflix',
    prime_video: 'Prime Video',
    prime: 'Prime Video',
    youtube: 'YouTube',
    apple_tv: 'Apple TV+',
    disney_plus: 'Disney+',
    hulu: 'Hulu',
    irokotv: 'iROKOtv',
  };
  const releaseType = String(film.release_type || '').trim().toLowerCase();
  const linkedPlatform = Object.keys(displayNames).find(key => Boolean(links[key]));
  const directPlatform = releaseType && !['cinema', 'unreleased'].includes(releaseType)
    ? releaseType
    : linkedPlatform;
  const releaseStr = film.release_date ? formatDateNice(film.release_date) : '';

  if (directPlatform && displayNames[directPlatform]) {
    const platformName = displayNames[directPlatform];
    if (directPlatform === 'youtube') {
      const channelName = text(film.youtube_channel_name);
      return channelName ? `Watch on YouTube via ${channelName} 📺` : 'Watch on YouTube 📺';
    }
    return releaseStr ? `Streaming on ${platformName} • ${releaseStr} 🍿` : `Streaming on ${platformName} 🍿`;
  }
  if (film.is_in_cinemas) {
    return releaseStr ? `In Cinemas • ${releaseStr} 🎟️` : `In Cinemas Now 🎟️`;
  }
  if (film.youtube_watch_url || film.source === 'youtube') {
    const channelName = text(film.youtube_channel_name);
    return channelName ? `Watch on YouTube via ${channelName} 📺` : `Watch on YouTube 📺`;
  }
  if (film.coming_soon) {
    return releaseStr ? `Coming Soon • ${releaseStr} ⏳` : `Coming Soon ⏳`;
  }
  if (releaseStr) {
    return `Release Date: ${releaseStr} 🎬`;
  }
  return null;
}

export function buildBirthdaySpotlightSnapshot(input: {
  person: Record<string, any>;
  credits?: Record<string, any>[];
  capturedAt: string;
  knownForLimit?: number;
}): BirthdaySpotlightSnapshot {
  const base = buildActorSpotlightSnapshot(input);
  const credits = Array.isArray(input.credits) ? input.credits : [];
  const dateOfBirth = String(text(input.person.date_of_birth) || '');

  const roles = rolesFromCredits(credits);
  if (!roles.length && base.knownForDepartment) roles.push(base.knownForDepartment);

  return {
    ...base,
    kind: 'birthday_spotlight',
    dateOfBirth,
    age: dateOfBirth ? ageOn(dateOfBirth, input.capturedAt) : null,
    roles,
  };
}

export function buildUpcomingMovieSnapshot(input: {
  film: Record<string, any>;
  credits?: Record<string, any>[];
  capturedAt: string;
  castLimit?: number;
}): UpcomingMovieSnapshot {
  const credits = Array.isArray(input.credits) ? input.credits : [];
  const limit = input.castLimit ?? 4;

  const topCast: SnapshotCastMember[] = credits
    .filter(credit => (!credit?.role || String(credit.role).toLowerCase() === 'actor') && credit?.people?.id && text(credit.people.name))
    .map(credit => ({
      personId: String(credit.people.id),
      name: String(text(credit.people.name)),
      handle: extractInstagramHandle(credit.people),
      character: text(credit.character_name),
    }))
    .slice(0, limit);

  const creditedPeople: SnapshotCreditedPerson[] = credits
    .filter(credit => credit?.people?.id && text(credit.people.name))
    .map(credit => ({
      personId: String(credit.people.id),
      name: String(text(credit.people.name)),
      instagramHandle: extractInstagramHandle(credit.people),
      role: String(text(credit.role) || 'actor').toLowerCase(),
      character: text(credit.character_name),
    }))
    .filter((credit): credit is SnapshotCreditedPerson => Boolean(credit.instagramHandle));

  const liked = input.film.liked_percent;
  const likedPercent = liked === null || liked === undefined ? null : integer(liked);

  return {
    kind: 'upcoming_movie',
    capturedAt: input.capturedAt,
    filmId: String(input.film.id),
    title: String(text(input.film.title) || 'Untitled'),
    slug: text(input.film.slug),
    posterUrl: text(input.film.poster_url),
    backdropUrl: text(input.film.backdrop_url) || text(input.film.backdrop),
    releaseDate: text(input.film.release_date),
    watchAvailability: formatWatchAvailability(input.film),
    year: yearFrom(input.film),
    synopsis: text(input.film.synopsis),
    tagline: text(input.film.tagline),
    genres: stringArray(input.film.genres),
    countries: stringArray(input.film.countries),
    languages: stringArray(input.film.languages),
    likedPercent,
    comingSoon: Boolean(input.film.coming_soon),
    isPublished: Boolean(input.film.is_published),
    topCast,
    creditedPeople,
    youtubeChannelName: text(input.film.youtube_channel_name),
    youtubeChannelHandle: text(input.film.youtube_channel_handle),
  };
}

export function buildTheatrePlaySnapshot(input: {
  play: Record<string, any>;
  capturedAt: string;
}): TheatrePlaySnapshot {
  return {
    kind: 'whats_on_stage',
    capturedAt: input.capturedAt,
    playId: String(input.play.id),
    title: String(text(input.play.title) || 'Untitled stage production'),
    slug: text(input.play.slug),
    posterUrl: text(input.play.poster_url),
    backdropUrl: text(input.play.backdrop_url),
    synopsis: text(input.play.synopsis),
    venue: text(input.play.venue),
    city: text(input.play.city),
    country: text(input.play.country),
    runStartDate: text(input.play.run_start_date),
    runEndDate: text(input.play.run_end_date),
    performanceTime: text(input.play.performance_time),
    playwright: text(input.play.playwright),
    director: text(input.play.director),
    status: text(input.play.status),
    year: yearFrom(input.play),
  };
}

/**
 * Conditions that do not block generation but that a reviewer should see before
 * approving — mostly missing artwork, which slice 2 needs in order to render.
 */
export function collectSnapshotWarnings(snapshot: SocialSourceSnapshot): string[] {
  const warnings: string[] = [];

  if (snapshot.kind === 'actor_spotlight' || snapshot.kind === 'birthday_spotlight') {
    if (!snapshot.photoUrl) warnings.push('Person has no photo_url; assets cannot be rendered from a portrait.');
    if (!snapshot.knownFor.length) warnings.push('Person has no linked film credits to feature.');

    if (snapshot.kind === 'birthday_spotlight') {
      if (!snapshot.dateOfBirth) warnings.push('Person has no date_of_birth; the card cannot claim a birthday.');
      else {
        // Not fatal — the card omits the age rather than inventing one — but a
        // reviewer should know the "turns N today" line will be missing.
        if (snapshot.age === null) warnings.push('date_of_birth has no usable year; age will be omitted.');

        // Generating a few days early to schedule is a normal workflow, so this
        // warns rather than refuses. But a card that says "Happy birthday" on
        // the wrong day is the single worst failure this template has, so a
        // reviewer must be told before it goes out.
        const days = daysUntilBirthday(snapshot.dateOfBirth, snapshot.capturedAt);
        if (days === null) warnings.push('date_of_birth is unparseable; cannot confirm the birthday.');
        else if (days > 7) {
          warnings.push(`Birthday is ${days} days away — this card greets them on the wrong day unless scheduled.`);
        }
      }
    }

    return warnings;
  }

  if (snapshot.kind === 'whats_on_stage') {
    if (!snapshot.posterUrl) warnings.push('Play has no poster_url; the stage template needs a production poster.');
    if (!snapshot.runStartDate && !snapshot.runEndDate) warnings.push('Play has no run date; the theatre card cannot show a date.');
    if (!snapshot.venue) warnings.push('Play has no venue; the theatre card will use a generic venue line.');
    return warnings;
  }

  if (!snapshot.posterUrl) warnings.push('Film has no poster_url; assets cannot be rendered from a poster.');
  if (!firstUsableCopy(snapshot.tagline, snapshot.synopsis)) {
    warnings.push('Film has no usable synopsis or tagline; the caption will have no blurb.');
  }
  if (!snapshot.isPublished) warnings.push('Film is not published on the site yet.');
  if (!snapshot.releaseDate) warnings.push('Film has no release_date.');

  return warnings;
}
