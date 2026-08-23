export type EditorialSeriesIntent =
  | 'people'
  | 'crew'
  | 'theatre'
  | 'critics'
  | 'streaming'
  | 'upcoming'
  | 'catalogue';

export type FilmLifecycle = 'upcoming' | 'now_streaming' | 'now_in_cinemas' | 'catalogue';

const PLATFORM_PRIORITY: Record<string, number> = {
  nollistream: 600,
  docuth: 500,
  ebonylife: 400,
  kava: 350,
  circuits: 300,
  youtube: 250,
  netflix: 150,
  prime_video: 140,
};

export function normalizeSeriesSlug(slug: string): string {
  return (slug || '').toLowerCase().replace(/^the[_-]/, '').replace(/-/g, '_');
}

export function getSeriesIntent(slug: string): EditorialSeriesIntent {
  const norm = normalizeSeriesSlug(slug);
  if (norm.includes('face') || norm.includes('rising') || norm.includes('supporting')) return 'people';
  if (norm.includes('camera') || norm.includes('crew') || norm.includes('craft') || norm.includes('director')) return 'crew';
  if (
    norm.includes('filmography') || norm.includes('actor') || norm.includes('star') ||
    norm.includes('spotlight') || norm.includes('stage_to_screen') || norm.includes('birthday') ||
    norm.includes('talent') || norm.includes('people')
  ) return 'people';
  if (norm.includes('stage') || norm.includes('theatre') || norm.includes('play')) return 'theatre';
  if (norm.includes('critic') || norm.includes('review') || norm.includes('take')) return 'critics';
  if (norm.includes('upcoming') || norm.includes('coming_soon') || norm.includes('announcement') || norm.includes('trailer')) return 'upcoming';
  if (norm.includes('watch') || norm.includes('streaming')) return 'streaming';
  return 'catalogue';
}

function dateValue(value: unknown): number | null {
  if (!value) return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveFilmPlatform(film: any): string | null {
  const releaseType = String(film?.release_type || '').toLowerCase();
  if (releaseType && releaseType !== 'cinema') return releaseType;
  if (film?.youtube_watch_url) return 'youtube';
  const links = film?.streaming_links && typeof film.streaming_links === 'object' ? film.streaming_links : {};
  for (const platform of ['nollistream', 'docuth', 'ebonylife', 'kava', 'circuits', 'youtube', 'netflix', 'prime_video']) {
    if (links[platform]) return platform;
  }
  return null;
}

export function classifyFilmLifecycle(film: any, referenceDate = new Date()): FilmLifecycle {
  const now = referenceDate.getTime();
  const release = dateValue(film?.release_date);
  const platform = resolveFilmPlatform(film);

  if (release !== null && release > now) return 'upcoming';
  if (film?.coming_soon === true && !platform) return 'upcoming';
  if (platform) return 'now_streaming';

  // Cinema flags frequently remain true after a theatrical run. Treat them as live
  // only from 14 days before release until 84 days after release.
  if (film?.is_in_cinemas === true && release !== null) {
    const ageDays = (now - release) / 86_400_000;
    if (ageDays >= -14 && ageDays <= 84) return 'now_in_cinemas';
  }
  return 'catalogue';
}

export function isFilmEligibleForIntent(film: any, intent: EditorialSeriesIntent, referenceDate = new Date()): boolean {
  const lifecycle = classifyFilmLifecycle(film, referenceDate);
  if (intent === 'streaming') return lifecycle === 'now_streaming';
  if (intent === 'upcoming') {
    const release = dateValue(film?.release_date);
    const withinOneYear = release !== null && release > referenceDate.getTime() && release <= referenceDate.getTime() + 366 * 86_400_000;
    return lifecycle === 'upcoming' && withinOneYear;
  }
  if (intent === 'catalogue') return lifecycle === 'catalogue' || lifecycle === 'now_streaming' || lifecycle === 'now_in_cinemas';
  return false;
}

export function filmCandidateScore(film: any, intent: EditorialSeriesIntent, referenceDate = new Date()): number {
  const lifecycle = classifyFilmLifecycle(film, referenceDate);
  const platform = resolveFilmPlatform(film);
  const release = dateValue(film?.release_date);
  const updated = dateValue(film?.updated_at) || dateValue(film?.created_at) || 0;
  const freshnessDays = updated ? Math.max(0, (referenceDate.getTime() - updated) / 86_400_000) : 3650;
  const completeness = (film?.poster_url ? 25 : 0) + (film?.synopsis ? 10 : 0) + (film?.backdrop_url || film?.backdrop ? 5 : 0);

  if (intent === 'streaming') {
    return (PLATFORM_PRIORITY[platform || ''] || 0) + Math.max(0, 120 - freshnessDays) + completeness;
  }
  if (intent === 'upcoming') {
    const daysUntilRelease = release ? Math.max(0, (release - referenceDate.getTime()) / 86_400_000) : 366;
    return 700 - Math.min(daysUntilRelease, 366) + (film?.trailer_youtube_id || film?.trailer_external_url ? 60 : 0) + completeness;
  }
  return (lifecycle === 'now_in_cinemas' ? 200 : lifecycle === 'now_streaming' ? 150 : 50) + Math.max(0, 90 - freshnessDays) + completeness;
}

export function rankAndDedupeFilms(films: any[], intent: EditorialSeriesIntent, limit: number, referenceDate = new Date()): any[] {
  const unique = new Map<string, any>();
  for (const film of films || []) {
    if (!film?.id || unique.has(film.id) || !isFilmEligibleForIntent(film, intent, referenceDate)) continue;
    unique.set(film.id, film);
  }
  return [...unique.values()]
    .sort((a, b) => filmCandidateScore(b, intent, referenceDate) - filmCandidateScore(a, intent, referenceDate))
    .slice(0, limit);
}
