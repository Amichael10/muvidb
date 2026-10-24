import { supabase } from '../supabase.js';
import { extractInstagramHandle, extractSocialHandle } from '../social-studio/content/snapshots.js';
import {
  classifyFilmLifecycle,
  getSeriesIntent,
  normalizeSeriesSlug,
  rankAndDedupeFilms,
  resolveFilmPlatform,
} from './candidate_strategy.js';

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
    const [creditsResult, channelVideosResult] = await Promise.all([
      supabase
        .from('credits')
        .select('film_id, role, character_name, billing_order, people(id, name, instagram_url, photo_url)')
        .in('film_id', filmIds)
        .order('billing_order', { ascending: true, nullsFirst: false }),
      supabase
        .from('channel_videos')
        .select('film_id,published_at,channels!inner(name,channel_handle)')
        .in('film_id', filmIds)
        .not('film_id', 'is', null)
        .order('published_at', { ascending: false, nullsFirst: false }),
    ]);

    if (creditsResult.error) throw creditsResult.error;
    if (channelVideosResult.error) throw channelVideosResult.error;

    const creditsByFilm: Record<string, { topCast: any[]; directors: any[]; creditedPeople: any[] }> = {};
    for (const c of (creditsResult.data || []) as any[]) {
      if (!c.film_id || !c.people) continue;
      if (!creditsByFilm[c.film_id]) creditsByFilm[c.film_id] = { topCast: [], directors: [], creditedPeople: [] };
      const person = c.people;
      const handle = extractInstagramHandle(person);
      const role = String(c.role || 'actor').toLowerCase();

      if (handle && !creditsByFilm[c.film_id].creditedPeople.some(entry => entry.id === person.id && entry.role === role)) {
        creditsByFilm[c.film_id].creditedPeople.push({
          id: person.id,
          name: person.name,
          handle,
          role,
          character: c.character_name,
        });
      }

      if ((role === 'actor' || !c.role) && creditsByFilm[c.film_id].topCast.length < 8) {
        creditsByFilm[c.film_id].topCast.push({
          id: person.id,
          name: person.name,
          handle,
          character: c.character_name,
        });
      } else if (role === 'director' && creditsByFilm[c.film_id].directors.length < 2) {
        creditsByFilm[c.film_id].directors.push({
          id: person.id,
          name: person.name,
          handle,
        });
      }
    }

    const channelByFilm = new Map<string, { name: string; handle: string | null; publishedAt: string | null }>();
    for (const video of (channelVideosResult.data || []) as any[]) {
      if (!video.film_id || channelByFilm.has(video.film_id) || !video.channels?.name) continue;
      channelByFilm.set(video.film_id, {
        name: video.channels.name,
        handle: video.channels.channel_handle || null,
        publishedAt: video.published_at || null,
      });
    }

    return films.map(f => ({
      ...f,
      topCast: creditsByFilm[f.id]?.topCast || [],
      directors: creditsByFilm[f.id]?.directors || [],
      creditedPeople: creditsByFilm[f.id]?.creditedPeople || [],
      youtubeChannelName: channelByFilm.get(f.id)?.name || null,
      youtubeChannelHandle: channelByFilm.get(f.id)?.handle || null,
      youtubePublishedAt: f.youtube_published_at || channelByFilm.get(f.id)?.publishedAt || null,
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
    const creditCountByPerson: Record<string, number> = {};
    const filmIdsByPerson: Record<string, Set<string>> = {};
    for (const c of (credits || []) as any[]) {
      if (!c.person_id || !c.films) continue;
      creditCountByPerson[c.person_id] = (creditCountByPerson[c.person_id] || 0) + 1;
      if (!filmIdsByPerson[c.person_id]) filmIdsByPerson[c.person_id] = new Set<string>();
      filmIdsByPerson[c.person_id].add(c.films.id);
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
      documentedCreditCount: creditCountByPerson[p.id] || 0,
      documentedFilmCount: filmIdsByPerson[p.id]?.size || 0,
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
        creditCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
        creditsCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
        documentedFilmCount: p.documentedFilmCount || p.film_count || 0,
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
      .limit(Math.max(limit * 8, 120));
    if (crewError) throw crewError;

    const craftCrew = (crew || []).filter((p) => {
      const dept = (p.known_for_department || '').toLowerCase();
      // Exclude pure actors who have no behind-the-camera department
      if (dept === 'actor' || dept === 'acting') return false;
      return (
        dept.includes('camera') ||
        dept.includes('writing') ||
        dept.includes('directing') ||
        dept.includes('director') ||
        dept.includes('editing') ||
        dept.includes('sound') ||
        dept.includes('costume') ||
        dept.includes('producer') ||
        dept.includes('production') ||
        dept.includes('post')
      );
    });

    // Partition into grassroots / YouTube up-and-coming craft (film_count <= 100) vs established (> 100)
    const grassroots = craftCrew.filter((p) => (p.film_count || 0) <= 100 && (p.film_count || 0) >= 3);
    const established = craftCrew.filter((p) => (p.film_count || 0) > 100);

    // Prioritize Lateef Olofin (esteemed post-production editor & first customer of MuviDB)
    const lateefIndex = grassroots.findIndex(
      (p) => p.slug === 'lateef-olofin' || (p.name && p.name.toLowerCase().includes('lateef olofin'))
    );
    if (lateefIndex > -1) {
      const [lateef] = grassroots.splice(lateefIndex, 1);
      grassroots.unshift(lateef);
    }

    // Interleave: 2 up-and-coming / grassroots to 1 established
    const targetList: typeof craftCrew = [];
    let gIdx = 0;
    let eIdx = 0;
    while (targetList.length < limit && (gIdx < grassroots.length || eIdx < established.length)) {
      if (gIdx < grassroots.length) targetList.push(grassroots[gIdx++]);
      if (targetList.length < limit && gIdx < grassroots.length) targetList.push(grassroots[gIdx++]);
      if (targetList.length < limit && eIdx < established.length) targetList.push(established[eIdx++]);
    }
    if (targetList.length === 0) targetList.push(...(craftCrew.length > 0 ? craftCrew : crew || []).slice(0, limit));

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
          creditCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
          creditsCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
          documentedFilmCount: p.documentedFilmCount || p.film_count || 0,
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

  // Ignore birthday series until dedicated designs exist
  if (norm.includes('birthday')) {
    return [];
  }

  // ── 3. FILMOGRAPHY / CAREER DEEP DIVES / ACTOR SPOTLIGHT ───────────────────
  if (
    norm.includes('filmography') ||
    norm.includes('actor') ||
    norm.includes('star') ||
    norm.includes('spotlight') ||
    norm.includes('stage_to_screen') ||
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
      .limit(Math.max(limit * 3, 50));
    if (peopleError) throw peopleError;

    // Also fetch up-and-coming grassroots & YouTube Nollywood talent (3 to 75 film credits)
    const { data: upAndComing } = await supabase
      .from('people')
      .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, profile_views, bio, popularity_score, known_for_department, instagram_url, twitter_url, date_of_birth')
      .not('photo_url', 'is', null)
      .gte('film_count', 3)
      .lte('film_count', 75)
      .not('bio', 'is', null)
      .order('film_count', { ascending: false, nullsFirst: false })
      .limit(Math.max(limit * 3, 50));

    // Interleave up-and-coming talent with established icons
    const mixedPeople: any[] = [];
    const seenIds = new Set<string>();
    const uList = upAndComing || [];
    const pList = people || [];
    let uI = 0;
    let pI = 0;
    while (mixedPeople.length < limit && (uI < uList.length || pI < pList.length)) {
      if (uI < uList.length) {
        const item = uList[uI++];
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          mixedPeople.push(item);
        }
      }
      if (mixedPeople.length < limit && pI < pList.length) {
        const item = pList[pI++];
        if (!seenIds.has(item.id)) {
          seenIds.add(item.id);
          mixedPeople.push(item);
        }
      }
    }

    const targetPeople = mixedPeople.length > 0 ? mixedPeople : (people || []);
    const enriched = await enrichPeopleCandidates(targetPeople.slice(0, limit));

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
        creditCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
        creditsCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
        documentedFilmCount: p.documentedFilmCount || p.film_count || 0,
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

  // ── 5. CRITICS ROUNDUP & VERDICTS (Recent movies only with critic reviews) ────────
  if (norm.includes('critic') || norm.includes('review') || norm.includes('take')) {
    const today = new Date();
    const recentCutoff = new Date(today.getTime() - 14 * 86_400_000);
    const todayDate = today.toISOString().slice(0, 10);
    const cutoffDate = recentCutoff.toISOString().slice(0, 10);

    const { data: reviews } = await supabase
      .from('critic_reviews')
      .select('id, film_id, critic_id, critic_name, critic_title, avatar_url, publication, social_handle, quote, rating, review_url, review_type, excerpt_context, critics(handle, publication, profile_url, platform), films!inner(id, title, slug, poster_url, backdrop_url, release_date, year, synopsis, tagline, liked_percent, imdb_rating, view_count, genres)')
      .not('quote', 'is', null)
      .gte('films.release_date', cutoffDate)
      .lte('films.release_date', todayDate)
      .order('created_at', { ascending: false })
      .limit(limit * 3);

    if (reviews && reviews.length > 0) {
      // Filter out rows where film poster is missing or quote is empty
      const validReviews = reviews.filter((r: any) => r.films?.poster_url && r.quote && r.quote.trim().length > 15);
      const rawFilms = validReviews.slice(0, limit).map((r: any) => ({
        ...r.films,
        criticReview: {
          id: r.id,
          criticName: r.critic_name,
          criticTitle: r.critic_title,
          avatarUrl: r.avatar_url,
          publication: r.publication || r.critics?.publication,
          socialHandle: r.social_handle || r.critics?.handle,
          quote: r.quote,
          rating: r.rating,
          reviewUrl: r.review_url,
          reviewType: r.review_type,
          excerptContext: r.excerpt_context,
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
        imageUrl: f.backdrop_url || f.poster_url,
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

  // ── AUDIENCE PULSE (films with real mined comments to quote) ───────────────
  // This card is nothing without quotes, so the pool is built from the reviews
  // table rather than filtered afterwards: a film with no comments can never be
  // scheduled for it. The series guard columns on social_content_series
  // (requires_reviews / min_reviews) are not read by anything, so the
  // constraint has to live here.
  if (norm.includes('audience_pulse') || norm.includes('pulse')) {
    const MIN_QUOTES = 3;
    const pulseSelect = 'id, title, slug, poster_url, backdrop_url, release_date, year, release_type, liked_percent, view_count, synopsis, genres, updated_at';

    const currentYear = new Date().getFullYear();
    const recentPulseCutoff = new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);

    const { data: films, error: pulseError } = await supabase
      .from('films')
      .select(pulseSelect)
      .eq('is_published', true)
      .not('poster_url', 'is', null)
      .gte('liked_percent', 60)
      .or(`release_date.gte.${recentPulseCutoff},year.gte.${currentYear}`)
      .order('liked_percent', { ascending: false })
      .limit(Math.max(limit * 8, 150));
    if (pulseError) throw pulseError;

    const ids = (films || []).map(f => f.id);
    if (!ids.length) return [];

    // Count quotable comments per film. Short enough to print whole, since the
    // card never truncates.
    const quotable = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const { data: rows, error: rowsError } = await supabase
        .from('reviews')
        .select('film_id,body,author_name')
        .in('film_id', ids.slice(i, i + 200))
        .eq('source', 'youtube')
        .gte('sentiment_score', 7);
      if (rowsError) throw rowsError;
      for (const row of rows || []) {
        const body = (row.body || '').replace(/\s+/g, ' ').trim();
        if (!row.author_name || body.length < 12 || body.length > 96) continue;
        quotable.set(row.film_id!, (quotable.get(row.film_id!) || 0) + 1);
      }
    }

    return (films || [])
      .filter(f => (quotable.get(f.id) || 0) >= MIN_QUOTES)
      .slice(0, limit)
      .map(f => ({
        id: f.id,
        type: 'movie' as const,
        name: f.title,
        subtext: `${f.liked_percent}% liked • ${quotable.get(f.id)} viewer comments`,
        imageUrl: f.poster_url,
        category: 'Audience Pulse',
        completenessScore: 0.9,
        data: { ...f, quotableComments: quotable.get(f.id) || 0 },
      }));
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
    const recentUploadCutoff = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const recentReleaseCutoff = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();

    const { data: recentChannelVideos, error: recentChannelVideosError } = await supabase
      .from('channel_videos')
      .select(`film_id,published_at,channels(name,channel_handle),films!inner(${filmSelect})`)
      .not('film_id', 'is', null)
      .gte('published_at', recentUploadCutoff)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(500);
    if (recentChannelVideosError) throw recentChannelVideosError;
    const recentUploadByFilm = new Map<string, any>();
    for (const video of (recentChannelVideos || []) as any[]) {
      if (video.film_id && !recentUploadByFilm.has(video.film_id)) recentUploadByFilm.set(video.film_id, video);
    }
    const platformQueries = ['nollistream', 'docuth', 'ebonylife', 'kava', 'circuits', 'netflix', 'prime_video'].map(platform =>
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .eq('release_type', platform)
        .or(`release_date.gte.${recentReleaseCutoff},year.gte.${currentYear}`)
        .order('updated_at', { ascending: false }).limit(Math.max(limit * 2, 20))
    );
    const [platformResults, youtubeRows, youtubeRecentRows, linkedRows] = await Promise.all([
      Promise.all(platformQueries),
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .not('youtube_watch_url', 'is', null)
        .or(`release_date.gte.${recentReleaseCutoff},year.gte.${currentYear}`)
        .order('updated_at', { ascending: false }).limit(poolLimit),
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .not('youtube_watch_url', 'is', null)
        .gte('created_at', recentUploadCutoff)
        .order('created_at', { ascending: false }).limit(poolLimit),
      supabase.from('films').select(filmSelect).not('poster_url', 'is', null)
        .not('streaming_links', 'is', null)
        .or(`release_date.gte.${recentReleaseCutoff},year.gte.${currentYear}`)
        .order('updated_at', { ascending: false }).limit(poolLimit),
    ]);
    const firstError = platformResults.find(result => result.error)?.error || youtubeRows.error || youtubeRecentRows.error || linkedRows.error;
    if (firstError) throw firstError;
    const uploadedFilms = ((recentChannelVideos || []) as any[]).map((upload: any) => {
      const film = Array.isArray(upload.films) ? upload.films[0] : upload.films;
      return {
        ...film,
        youtube_published_at: upload?.published_at || null,
        youtubeChannelName: upload?.channels?.name || null,
        youtubeChannelHandle: upload?.channels?.channel_handle || null,
      };
    }).filter((film: any) => film?.id && film?.poster_url);
    filmRows = [
      ...uploadedFilms,
      ...platformResults.flatMap(result => result.data || []),
      ...(youtubeRows.data || []),
      ...(youtubeRecentRows.data || []),
      ...(linkedRows.data || [])
    ].map((film: any) => {
      const upload = recentUploadByFilm.get(film.id);
      return upload ? {
        ...film,
        youtube_published_at: upload.published_at || film.youtube_published_at || null,
        youtubeChannelName: upload.channels?.name || film.youtubeChannelName || null,
        youtubeChannelHandle: upload.channels?.channel_handle || film.youtubeChannelHandle || null,
      } : film;
    });
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
            creditCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
            creditsCount: p.documentedCreditCount || p.film_count || (p.knownFor?.length ?? 0),
            documentedFilmCount: p.documentedFilmCount || p.film_count || 0,
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
      .select('id, title, slug, poster_url, backdrop_url, release_date, year, release_type, streaming_links, youtube_watch_url, is_in_cinemas, coming_soon, synopsis, tagline, genres, liked_percent, imdb_rating, view_count')
      .ilike('title', `%${trimmed}%`)
      .order('year', { ascending: false })
      .limit(limit);

    if (films && films.length > 0) {
      const enrichedFilms = await enrichFilmCandidates(films);
      enrichedFilms.forEach((f) => {
        const platform = resolveFilmPlatform(f);
        const lifecycle = classifyFilmLifecycle(f);
        const platformName = platform
          ? (PLATFORM_DISPLAY_NAMES[platform] || platform)
          : lifecycle === 'now_in_cinemas'
            ? 'In Cinemas'
            : lifecycle === 'upcoming'
              ? 'Coming Soon'
              : 'MuviDB Catalogue';
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
            lifecycle,
            platform,
            platformDisplayName: platformName,
            watchAvailability: lifecycle === 'now_streaming'
              ? `Now Streaming on ${platformName}`
              : lifecycle === 'now_in_cinemas'
                ? 'In Cinemas Now'
                : lifecycle === 'upcoming'
                  ? 'Coming Soon'
                  : 'MuviDB Catalogue',
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


