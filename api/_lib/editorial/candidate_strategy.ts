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

export function isLikelyLandscapeOrThumbnailUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string' || !url.trim()) return true;
  return /ytimg\.com|img\.youtube\.com|hqdefault|maxresdefault|sddefault|mqdefault|\/vi\/|(?:^|[-_/])(?:backdrop|banner|landscape|wide|horizontal)(?:[-_./]|$)/i.test(url);
}

export function isFilmEligibleForIntent(film: any, intent: EditorialSeriesIntent, referenceDate = new Date()): boolean {
  // Films must have artwork (either poster, square artwork, or landscape thumbnail/backdrop)
  if (!film?.poster_url && !film?.backdrop_url && !film?.backdrop) return false;

  // A landscape thumbnail cannot stand in for a portrait poster on a social
  // card. Every downstream consumer already rejects these one by one
  // (morning_social_briefing, calendar_service, social_studio), so letting them
  // through here only made the ranked pool look larger than it really was.
  if (film?.poster_url && isLikelyLandscapeOrThumbnailUrl(film.poster_url)) return false;

  const lifecycle = classifyFilmLifecycle(film, referenceDate);
  if (intent === 'streaming') {
    if (lifecycle !== 'now_streaming') return false;

    // Strict editorial rule: Never post old movies - only fresh new releases (1 to 7 days).
    const nowMs = referenceDate.getTime();
    const currentYear = referenceDate.getFullYear();
    const release = dateValue(film?.release_date);
    const filmYear = film?.year ? Number(film.year) : null;
    const maxAgeDays = 7;
    const maxAgeMs = maxAgeDays * 86_400_000;

    // 1. If release_date is known, must not be older than 7 days (never from previous years)
    if (release !== null) {
      if (release < nowMs - maxAgeMs) return false;
    } else if (filmYear !== null && filmYear < currentYear) {
      // No release_date, but year is from a previous calendar year
      return false;
    }

    // 2. If it is a YouTube upload, the upload date itself must not be older than 7 days
    const uploadDate = dateValue(film?.youtubePublishedAt || film?.youtube_published_at);
    if (uploadDate !== null && uploadDate < nowMs - maxAgeMs) {
      return false;
    }

    // 3. If neither release_date nor uploadDate is known, reject if created long ago or old year
    if (release === null && uploadDate === null) {
      if (filmYear !== null && filmYear < currentYear) return false;
      const created = dateValue(film?.created_at);
      if (created !== null && created < nowMs - maxAgeMs) return false;
    }

    return true;
  }
  if (intent === 'upcoming') {
    const release = dateValue(film?.release_date);
    const withinOneYear = release !== null && release > referenceDate.getTime() && release <= referenceDate.getTime() + 366 * 86_400_000;
    return lifecycle === 'upcoming' && withinOneYear;
  }
  if (intent === 'catalogue') {
    // Strictly reject older movies from prior years or movies released > 7 days ago (1-7 days policy)
    const nowMs = referenceDate.getTime();
    const currentYear = referenceDate.getFullYear();
    const release = dateValue(film?.release_date);
    const upload = dateValue(film?.youtubePublishedAt || film?.youtube_published_at);
    const effectiveDate = release || upload;
    const filmYear = film?.year ? Number(film.year) : null;
    const maxAgeMs = 7 * 86_400_000; // strictly 1 to 7 days for active social spotlights

    if (effectiveDate !== null) {
      if (effectiveDate < nowMs - maxAgeMs) return false;
    } else if (filmYear !== null && filmYear < currentYear) {
      return false;
    }

    return lifecycle === 'catalogue' || lifecycle === 'now_streaming' || lifecycle === 'now_in_cinemas';
  }
  return false;
}

export function filmCandidateScore(film: any, intent: EditorialSeriesIntent, referenceDate = new Date()): number {
  const lifecycle = classifyFilmLifecycle(film, referenceDate);
  const platform = resolveFilmPlatform(film);
  const release = dateValue(film?.release_date);
  const upload = dateValue(film?.youtubePublishedAt || film?.youtube_published_at);
  const effectiveDate = release || upload;
  // Calculate freshness from actual release/upload date — never use database updated_at
  const freshnessDays = effectiveDate ? Math.max(0, (referenceDate.getTime() - effectiveDate) / 86_400_000) : 365;
  const completeness = ((film?.poster_url || film?.backdrop_url) ? 25 : 0) + (film?.synopsis ? 10 : 0) + (film?.backdrop_url || film?.backdrop ? 5 : 0);

  if (intent === 'streaming') {
    // High prominence to new YouTube uploads
    let youtubeRecencyBonus = 0;
    if (platform === 'youtube' && (film?.poster_url || film?.backdrop_url)) {
      const uploadRecency = upload !== null
        ? Math.max(0, (referenceDate.getTime() - upload) / 86_400_000)
        : null;
      if (uploadRecency !== null && uploadRecency <= 7) {
        youtubeRecencyBonus = 1200; // Released in the last 7 days gets top prominence
      } else if (uploadRecency !== null && uploadRecency <= 14) {
        youtubeRecencyBonus = 900;  // Released in the last 2 weeks
      } else if (uploadRecency !== null && uploadRecency <= 30) {
        youtubeRecencyBonus = 600;  // Released in the last month
      } else if (uploadRecency !== null && uploadRecency <= 90) {
        youtubeRecencyBonus = 350;  // Released in the last 3 months
      } else if (uploadRecency !== null) {
        youtubeRecencyBonus = 150;
      }
    }

    return (PLATFORM_PRIORITY[platform || ''] || 0) + youtubeRecencyBonus + Math.max(0, 120 - freshnessDays) + completeness;
  }
  if (intent === 'upcoming') {
    const daysUntilRelease = release ? Math.max(0, (release - referenceDate.getTime()) / 86_400_000) : 366;
    return 700 - Math.min(daysUntilRelease, 366) + (film?.trailer_youtube_id || film?.trailer_external_url ? 60 : 0) + completeness;
  }
  return (lifecycle === 'now_in_cinemas' ? 200 : lifecycle === 'now_streaming' ? 150 : 50) + Math.max(0, 90 - freshnessDays) + completeness;
}

export function rankAndDedupeFilms(
  films: any[],
  intent: EditorialSeriesIntent,
  limit: number,
  referenceDate = new Date(),
  excludedIds?: Set<string>,
): any[] {
  const unique = new Map<string, any>();
  for (const film of films || []) {
    if (!film?.id || unique.has(film.id) || (excludedIds && excludedIds.has(film.id)) || !isFilmEligibleForIntent(film, intent, referenceDate)) continue;
    unique.set(film.id, film);
  }
  return [...unique.values()]
    .sort((a, b) => filmCandidateScore(b, intent, referenceDate) - filmCandidateScore(a, intent, referenceDate))
    .slice(0, limit);
}
