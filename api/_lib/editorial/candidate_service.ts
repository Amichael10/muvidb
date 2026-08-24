import { createClient } from '@supabase/supabase-js';
import { extractSocialHandle } from '../social-studio/content/snapshots.js';
import {
  classifyFilmLifecycle,
  getSeriesIntent,
  normalizeSeriesSlug,
  rankAndDedupeFilms,
  resolveFilmPlatform,
} from './candidate_strategy.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface CandidateEntity {
  id: string;
  type: 'movie' | 'person' | 'critic' | 'play' | 'company';
  name: string;
  subtext?: string;
  imageUrl?: string;
  country?: string;
  category?: string;
  completenessScore: number;
  data: Record<string, any>;
}

const PLATFORM_DISPLAY_NAMES: Record<string, string> = {
  nollistream: 'NolliStream',
  docuth: 'Docuth',
  ebonylife: 'EbonyLife ON Plus',
  kava: 'Kava',
  circuits: 'Circuits.tv',
  netflix: 'Netflix',
  prime_video: 'Prime Video',
  youtube: 'YouTube',
  cinema: 'In Cinemas',
};

/**
 * Classifies crew members into primary craft departments
 */
function classifyCrewDepartment(professions: string[] = [], knownForDept?: string | null): string {
  const profList = professions.map((p) => p.toLowerCase());
  const dept = (knownForDept || '').toLowerCase();

  if (profList.some((p) => p.includes('cinematograph') || p.includes('camera') || p.includes('director of photography')) || dept.includes('camera')) {
    return 'Cinematographer';
  }
  if (profList.some((p) => p.includes('writer') || p.includes('screenplay') || p.includes('script')) || dept.includes('writing')) {
    return 'Screenwriter';
  }
  if (profList.some((p) => p.includes('director')) || dept.includes('directing')) {
    return 'Director';
  }
  if (profList.some((p) => p.includes('editor')) || dept.includes('editing')) {
    return 'Film Editor';
  }
  if (profList.some((p) => p.includes('costume') || p.includes('wardrobe') || p.includes('styling') || p.includes('production design')) || dept.includes('costume')) {
    return 'Costume & Production Designer';
  }
  if (profList.some((p) => p.includes('sound') || p.includes('score') || p.includes('composer') || p.includes('music')) || dept.includes('sound')) {
    return 'Sound Designer';
  }
  if (profList.some((p) => p.includes('producer')) || dept.includes('production')) {
    return 'Producer';
  }
  return 'Filmmaker';
}

/**
 * Derive live status ('upcoming' | 'currently_running' | 'archived') for plays
 */
export function derivePlayStatus(play: any, refDate = new Date()): 'upcoming' | 'currently_running' | 'archived' {
  const todayStr = refDate.toISOString().slice(0, 10);
  const currentYear = refDate.getFullYear();

  const start = play?.run_start_date ? String(play.run_start_date).slice(0, 10) : null;
  const end = play?.run_end_date ? String(play.run_end_date).slice(0, 10) : null;

  if (start && end) {
    if (end < todayStr) return 'archived';
    if (start <= todayStr && end >= todayStr) return 'currently_running';
    return 'upcoming';
  }

  if (start && !end) {
    if (start < todayStr) return 'archived';
    if (start === todayStr) return 'currently_running';
    return 'upcoming';
  }

  if (!start && end) {
    if (end < todayStr) return 'archived';
    return 'currently_running';
  }

  if (play?.year && Number(play.year) < currentYear) {
    return 'archived';
  }

  return (play?.status as any) || 'archived';
}

/**
 * Helper to batch enrich movie candidates with cast and director credits
 */
async function enrichFilmCandidates(films: any[]): Promise<any[]> {
  if (!films || !films.length) return films;
  const filmIds = films.map(f => f.id).filter(Boolean);
  if (!filmIds.length) return films;

  try {
    const { data: credits } = await supabase
      .from('credits')
      .select('film_id, role, character_name, billing_order, people(id, name, instagram_url, twitter_url, tiktok_url, photo_url)')
      .in('film_id', filmIds)
      .order('billing_order', { ascending: true, nullsFirst: false });

    const creditsByFilm: Record<string, { topCast: any[]; directors: any[] }> = {};
    for (const c of (credits || []) as any[]) {
      if (!c.film_id || !c.people) continue;
      if (!creditsByFilm[c.film_id]) creditsByFilm[c.film_id] = { topCast: [], directors: [] };
      const person = c.people;
      const handle = extractSocialHandle(person);

      if ((c.role === 'actor' || !c.role) && creditsByFilm[c.film_id].topCast.length < 6) {
        creditsByFilm[c.film_id].topCast.push({
          id: person.id,
          name: person.name,
          handle,
          character: c.character_name,
        });
      } else if (c.role === 'director' && creditsByFilm[c.film_id].directors.length < 2) {
        creditsByFilm[c.film_id].directors.push({
          id: person.id,
          name: person.name,
          handle,
        });
      }
    }

    return films.map(f => ({
      ...f,
      topCast: creditsByFilm[f.id]?.topCast || [],
      directors: creditsByFilm[f.id]?.directors || [],
    }));
  } catch (err) {
    console.warn('Failed to enrich films with credits:', err);
    return films;
  }
}

/**
 * Helper to batch enrich people candidates with top film credits
 */
async function enrichPeopleCandidates(people: any[]): Promise<any[]> {
  if (!people || !people.length) return people;
  const personIds = people.map(p => p.id).filter(Boolean);
  if (!personIds.length) return people;

  try {
    const { data: credits } = await supabase
      .from('credits')
      .select('person_id, role, character_name, billing_order, films(id, title, year, poster_url)')
      .in('person_id', personIds)
      .order('billing_order', { ascending: true, nullsFirst: false });

    const filmsByPerson: Record<string, any[]> = {};
    for (const c of (credits || []) as any[]) {
      if (!c.person_id || !c.films) continue;
      if (!filmsByPerson[c.person_id]) filmsByPerson[c.person_id] = [];
      if (filmsByPerson[c.person_id].length < 5) {
        filmsByPerson[c.person_id].push({
          id: c.films.id,
          title: c.films.title,
          year: c.films.year,
          posterUrl: c.films.poster_url,
          character: c.character_name,
        });
      }
    }

    return people.map(p => ({
      ...p,
      knownFor: filmsByPerson[p.id] || [],
    }));
  } catch (err) {
    console.warn('Failed to enrich people with credits:', err);
    return people;
  }
}

/**
 * Fetch candidate entities for a given content series from MuviDB Postgres tables.
 */
export async function fetchSeriesCandidates(seriesSlug: string, limit = 30): Promise<CandidateEntity[]> {
  const norm = normalizeSeriesSlug(seriesSlug);
  const intent = getSeriesIntent(seriesSlug);

  // ── 1. RISING STARS & SUPPORTING ACTORS (you_know_the_face / rising_stars) ─
  if (norm.includes('face') || norm.includes('rising') || norm.includes('supporting')) {
    let { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url, updated_at')
      .not('photo_url', 'is', null)
      .gte('film_count', 3)
      .lte('film_count', 15)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .order('profile_views', { ascending: false, nullsFirst: false })
      .limit(limit * 4);
    if (peopleError) throw peopleError;

    if (!people || people.length === 0) {
      const { data: fallbackPeople, error: fallbackError } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url, updated_at')
        .not('photo_url', 'is', null)
        .order('popularity_score', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (fallbackError) throw fallbackError;
      people = fallbackPeople || [];
    }

    const enriched = await enrichPeopleCandidates(people.slice(0, limit));

    return enriched.map((p) => ({
      id: p.id,
      type: 'person',
      name: p.name,
      subtext: `${p.film_count || 0} credits • ${p.nationality || 'Nollywood'} • ✨ Rising Star`,
      imageUrl: p.photo_cutout_url || p.photo_url,
      country: p.nationality,
      category: 'Rising Star',
      completenessScore: p.bio ? 0.9 : 0.75,
      data: {
        ...p,
        isRisingStar: true,
        handle: extractSocialHandle(p),
        socialHandles: {
          instagram: p.instagram_url,
          twitter: p.twitter_url,
        },
      },
    }));
  }

  // ── 2. CREW & BEHIND THE CAMERA (DP, Writer, Director, Editor, Sound, Costume) ─
  if (norm.includes('camera') || norm.includes('crew') || norm.includes('craft') || norm.includes('director')) {
    const { data: crew, error: crewError } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url')
      .not('photo_url', 'is', null)
      .not('known_for_department', 'is', null)
      .order('film_count', { ascending: false, nullsFirst: false })
      .limit(limit * 3);
    if (crewError) throw crewError;

    const craftCrew = (crew || []).filter((p) => {
      const dept = (p.known_for_department || '').toLowerCase();
      return (
        dept.includes('camera') ||
        dept.includes('writing') ||
        dept.includes('directing') ||
        dept.includes('editing') ||
        dept.includes('sound') ||
        dept.includes('costume')
      );
    });

    const targetList = craftCrew.length > 0 ? craftCrew : (crew || []);
    const enriched = await enrichPeopleCandidates(targetList.slice(0, limit));

    return enriched.map((p) => {
      const department = classifyCrewDepartment([], p.known_for_department);
      return {
        id: p.id,
        type: 'person',
        name: p.name,
        subtext: `${department} • ${p.nationality || 'African Cinema'} • 🎬 Craft Spotlight`,
        imageUrl: p.photo_cutout_url || p.photo_url,
        country: p.nationality,
        category: department,
        completenessScore: p.bio ? 0.9 : 0.8,
        data: {
          ...p,
          isCrew: true,
          department,
          handle: extractSocialHandle(p),
          socialHandles: {
            instagram: p.instagram_url,
            twitter: p.twitter_url,
          },
        },
      };
    });
  }

  // ── 3. FILMOGRAPHY / CAREER DEEP DIVES / ACTOR SPOTLIGHT ───────────────────
  if (
    norm.includes('filmography') ||
    norm.includes('actor') ||
    norm.includes('star') ||
    norm.includes('spotlight') ||
    norm.includes('stage_to_screen') ||
    norm.includes('birthday') ||
    norm.includes('talent') ||
    norm.includes('people')
  ) {
    let { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url, date_of_birth')
      .not('photo_url', 'is', null)
      .order('popularity_score', { ascending: false, nullsFirst: false })
      .order('profile_views', { ascending: false, nullsFirst: false })
      .order('film_count', { ascending: false, nullsFirst: false })
      .limit(limit * 4);
    if (peopleError) throw peopleError;

    if (!people || people.length === 0) {
      const { data: fallbackPeople, error: fallbackError } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url, date_of_birth')
        .order('film_count', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (fallbackError) throw fallbackError;
      people = fallbackPeople || [];
    }

    const enriched = await enrichPeopleCandidates(people.slice(0, limit));

    return enriched.map((p) => ({
      id: p.id,
      type: 'person',
      name: p.name,
      subtext: `${p.film_count || 0} credits • ${p.nationality || 'African Cinema'} • Verified Talent`,
      imageUrl: p.photo_cutout_url || p.photo_url,
      country: p.nationality,
      category: p.known_for_department || 'Actor Spotlight',
      completenessScore: p.bio ? 0.9 : 0.8,
      data: {
        ...p,
        handle: extractSocialHandle(p),
      },
    }));
  }

  // ── 4. THEATRE & LIVE STAGE ────────────────────────────────────────────────
  if (norm.includes('stage') || norm.includes('theatre') || norm.includes('play')) {
    const { data: plays } = await supabase
      .from('plays')
      .select('id, title, slug, venue, city, country, run_start_date, run_end_date, poster_url, status, synopsis, playwright, year')
      .not('status', 'eq', 'archived')
      .order('run_start_date', { ascending: false })
      .limit(limit * 3);

    const now = new Date();
    // Filter out all archived or ended plays — only active/upcoming productions are eligible for social posts
    const activePlays = (plays || []).filter((p) => {
      const derived = derivePlayStatus(p, now);
      return derived !== 'archived' && p.status !== 'archived';
    });

    return activePlays.slice(0, limit).map((p) => ({
      id: p.id,
      type: 'play' as const,
      name: p.title,
      subtext: `${p.venue || 'Stage'} • ${p.city || 'Lagos'} (${p.status === 'currently_running' ? 'Now Showing' : 'Upcoming'})`,
      imageUrl: p.poster_url,
      country: p.country,
      completenessScore: p.poster_url ? 0.9 : 0.7,
      data: p,
    }));
  }

  // ── 5. CRITICS ROUNDUP & VERDICTS (Real movies with critic reviews) ────────
  if (norm.includes('critic') || norm.includes('review') || norm.includes('take')) {
    const { data: reviews } = await supabase
      .from('critic_reviews')
      .select('id, film_id, critic_name, publication, quote, rating, films!inner(id, title, slug, poster_url, backdrop_url, release_date, year, synopsis, tagline, liked_percent, imdb_rating, view_count, genres)')
      .not('quote', 'is', null)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (reviews && reviews.length > 0) {
      const rawFilms = reviews.map((r: any) => ({
        ...r.films,
        criticReview: {
          id: r.id,
          criticName: r.critic_name,
          publication: r.publication,
          quote: r.quote,
          rating: r.rating,
        },
      }));

      const enriched = await enrichFilmCandidates(rawFilms);

      return enriched.map((f: any) => ({
        id: f.id,
        type: 'movie' as const,
        name: f.title,
        subtext: f.criticReview?.quote
          ? `“${f.criticReview.quote.slice(0, 70)}…” — ${f.criticReview.criticName || 'Critic'}`
          : `Reviewed by ${f.criticReview?.criticName || 'Critic'} (${f.criticReview?.publication || 'Review'})`,
        imageUrl: f.poster_url,
        country: 'Nollywood',
        category: 'Critic Verdict',
        completenessScore: 0.9,
        data: {
          ...f,
          isCriticFeatured: true,
        },
      }));
    }
  }

  // Person, theatre and critic series must never fall through to a film pool.
  if (intent === 'people' || intent === 'crew' || intent === 'theatre' || intent === 'critics') return [];

  // Fetch a broad film pool once, then apply lifecycle eligibility and editorial ranking.
  // This deliberately avoids the old "any recent row" fallback, which mixed stale cinema,
  // upcoming and streaming titles into every series.
  const filmSelect = 'id, title, slug, poster_url, backdrop_url, backdrop, release_date, year, release_type, streaming_links, youtube_watch_url, liked_percent, imdb_rating, view_count, synopsis, tagline, genres, coming_soon, is_in_cinemas, trailer_youtube_id, trailer_external_url, created_at, updated_at';
  const poolLimit = Math.max(limit * 6, 100);
  let filmRows: any[] = [];

  if (intent === 'streaming') {
    // Query active destinations directly so NolliStream/Docuth titles cannot be
    // pushed out of the pool by unrelated rows with newer update timestamps.
    const platformQueries = ['nollistream', 'docuth', 'ebonylife', 'kava', 'circuits', 'netflix', 'prime_video'].map(platform =>
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .eq('release_type', platform).order('updated_at', { ascending: false }).limit(Math.max(limit * 2, 20))
    );
    const [platformResults, youtubeRows, linkedRows] = await Promise.all([
      Promise.all(platformQueries),
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .not('youtube_watch_url', 'is', null).order('updated_at', { ascending: false }).limit(poolLimit),
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .not('streaming_links', 'is', null).order('updated_at', { ascending: false }).limit(poolLimit),
    ]);
    const firstError = platformResults.find(result => result.error)?.error || youtubeRows.error || linkedRows.error;
    if (firstError) throw firstError;
    filmRows = [...platformResults.flatMap(result => result.data || []), ...(youtubeRows.data || []), ...(linkedRows.data || [])];
  } else if (intent === 'upcoming') {
    const today = new Date();
    const horizon = new Date(today.getTime() + 366 * 86_400_000);
    const { data, error } = await supabase.from('films').select(filmSelect)
      .not('poster_url', 'is', null)
      .gt('release_date', today.toISOString().slice(0, 10))
      .lte('release_date', horizon.toISOString().slice(0, 10))
      .order('release_date', { ascending: true })
      .limit(poolLimit);
    if (error) throw error;
    filmRows = data || [];
  } else {
    const { data, error } = await supabase.from('films').select(filmSelect)
      .not('poster_url', 'is', null).order('updated_at', { ascending: false }).limit(poolLimit);
    if (error) throw error;
    filmRows = data || [];
  }

  const rankedFilms = rankAndDedupeFilms(filmRows, intent, limit);
  const enriched = await enrichFilmCandidates(rankedFilms);

  return enriched.map((f: any) => {
    const platform = resolveFilmPlatform(f);
    const lifecycle = classifyFilmLifecycle(f);
    const platformName = platform
      ? (PLATFORM_DISPLAY_NAMES[platform] || platform)
      : lifecycle === 'now_in_cinemas'
        ? 'In Cinemas'
        : null;
    const lifecycleLabel = lifecycle === 'upcoming'
      ? 'Coming Soon'
      : lifecycle === 'now_in_cinemas'
        ? 'In Cinemas Now'
        : lifecycle === 'now_streaming'
          ? `Now Streaming on ${platformName || 'a verified platform'}`
          : 'Film Spotlight';

    return {
      id: f.id,
      type: 'movie' as const,
      name: f.title,
      subtext: `${lifecycleLabel}${f.year ? ` • ${f.year}` : ''}`,
      imageUrl: f.poster_url,
      completenessScore: f.poster_url ? 0.95 : 0.7,
      category: lifecycleLabel,
      data: {
        ...f,
        lifecycle,
        lifecycleLabel,
        platform,
        platformDisplayName: platformName,
        watchAvailability: lifecycleLabel,
        coming_soon: lifecycle === 'upcoming',
        editorialIntent: intent,
        selectionReason: intent === 'streaming'
          ? `${platformName || 'Verified platform'} availability and platform priority`
          : lifecycle === 'upcoming'
            ? 'Verified future release date'
            : 'Eligible catalogue title',
      },
    };
  });
}

/**
 * Search people and films across MuviDB for manual candidate assignment in Social Studio.
 */
export async function searchCandidates(
  query: string,
  type: 'all' | 'person' | 'movie' | 'play' = 'all',
  limit = 20,
): Promise<CandidateEntity[]> {
  const trimmed = (query || '').trim();
  if (!trimmed) return [];

  const results: CandidateEntity[] = [];

  // 1. Search People
  if (type === 'all' || type === 'person') {
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url')
      .ilike('name', `%${trimmed}%`)
      .order('film_count', { ascending: false, nullsFirst: false })
      .limit(limit);
    if (peopleError) throw peopleError;

    if (people && people.length > 0) {
      const enrichedPeople = await enrichPeopleCandidates(people);
      enrichedPeople.forEach((p) => {
        results.push({
          id: p.id,
          type: 'person',
          name: p.name,
          subtext: `${p.film_count || 0} credits • ${p.nationality || 'Nollywood'} • ${p.known_for_department || 'Talent'}`,
          imageUrl: p.photo_cutout_url || p.photo_url,
          country: p.nationality,
          category: p.known_for_department || 'Actor Spotlight',
          completenessScore: p.bio ? 0.9 : 0.8,
          data: {
            ...p,
            handle: extractSocialHandle(p),
            socialHandles: {
              instagram: p.instagram_url,
              twitter: p.twitter_url,
            },
          },
        });
      });
    }
  }

  // 2. Search Films
  if (type === 'all' || type === 'movie') {
    const { data: films } = await supabase
      .from('films')
      .select('id, title, slug, poster_url, backdrop_url, release_date, year, release_type, streaming_links, is_in_cinemas, synopsis, tagline, genres, liked_percent, imdb_rating, view_count')
      .ilike('title', `%${trimmed}%`)
      .order('year', { ascending: false })
      .limit(limit);

    if (films && films.length > 0) {
      const enrichedFilms = await enrichFilmCandidates(films);
      enrichedFilms.forEach((f) => {
        const platformName = PLATFORM_DISPLAY_NAMES[f.release_type || ''] || (f.is_in_cinemas ? 'In Cinemas' : 'Streaming');
        results.push({
          id: f.id,
          type: 'movie',
          name: f.title,
          subtext: `${f.year || 'Film'} • ${platformName} • ${(f.genres || []).slice(0, 2).join(', ') || 'Nollywood'}`,
          imageUrl: f.poster_url,
          completenessScore: 0.85,
          category: platformName,
          data: {
            ...f,
            platform: f.release_type,
            platformDisplayName: platformName,
          },
        });
      });
    }
  }

  // 3. Search Plays
  if (type === 'all' || type === 'play') {
    const { data: plays } = await supabase
      .from('plays')
      .select('id, title, slug, poster_url, backdrop_url, year, venue, city, country, run_start_date, run_end_date, synopsis, status')
      .ilike('title', `%${trimmed}%`)
      .limit(5);

    if (plays && plays.length > 0) {
      plays.forEach((pl: any) => {
        const derivedStatus = derivePlayStatus(pl);
        results.push({
          id: pl.id,
          type: 'play',
          name: pl.title,
          subtext: `${pl.venue || 'Theatre'} • ${pl.city || 'Lagos'} • Live Production`,
          imageUrl: pl.poster_url || pl.backdrop_url,
          country: pl.country || 'Nigeria',
          category: 'Stage to Screen',
          completenessScore: 0.8,
          data: {
            ...pl,
            derivedStatus,
          },
        });
      });
    }
  }

  return results.slice(0, limit);
}


