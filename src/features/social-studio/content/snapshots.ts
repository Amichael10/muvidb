import type { SocialContentType } from '../domain/content-types';
import { firstUsableCopy, isLikelyFilmTitle } from './copy-quality';

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
  character: string | null;
};

export type ActorSpotlightSnapshot = {
  kind: 'actor_spotlight';
  capturedAt: string;
  personId: string;
  name: string;
  slug: string | null;
  photoUrl: string | null;
  /**
   * Background-removed portrait, when the cut-out job has produced one. Cards
   * prefer this so the subject can sit over brand shapes; `photoUrl` is the
   * fallback and still renders a usable card.
   */
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
};

export type SocialSourceSnapshot = ActorSpotlightSnapshot | UpcomingMovieSnapshot;

export const SOURCE_ENTITY_TYPES: Record<SocialContentType, 'person' | 'film'> = {
  actor_spotlight: 'person',
  upcoming_movie: 'film',
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

export function buildUpcomingMovieSnapshot(input: {
  film: Record<string, any>;
  credits?: Record<string, any>[];
  capturedAt: string;
  castLimit?: number;
}): UpcomingMovieSnapshot {
  const credits = Array.isArray(input.credits) ? input.credits : [];
  const limit = input.castLimit ?? 4;

  const topCast: SnapshotCastMember[] = credits
    .filter(credit => credit?.people?.id && text(credit.people.name))
    .map(credit => ({
      personId: String(credit.people.id),
      name: String(text(credit.people.name)),
      character: text(credit.character_name),
    }))
    .slice(0, limit);

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
  };
}

/**
 * Conditions that do not block generation but that a reviewer should see before
 * approving — mostly missing artwork, which slice 2 needs in order to render.
 */
export function collectSnapshotWarnings(snapshot: SocialSourceSnapshot): string[] {
  const warnings: string[] = [];

  if (snapshot.kind === 'actor_spotlight') {
    if (!snapshot.photoUrl) warnings.push('Person has no photo_url; assets cannot be rendered from a portrait.');
    if (!snapshot.knownFor.length) warnings.push('Person has no linked film credits to feature.');
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
