import { createClient } from '@supabase/supabase-js';
import { extractSocialHandle } from '../social-studio/content/snapshots.js';

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

const EMERGING_PLATFORMS = ['nollistream', 'docuth', 'ebonylife', 'kava', 'circuits'];

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
  switch (seriesSlug) {
    // ── RISING STARS & SUPPORTING ACTORS (No superstar bias) ───────────────
    case 'you_know_the_face': {
      const { data: people } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, country, film_count, professions, bio, profile_completeness, popularity_score, instagram_url, twitter_url')
        .not('photo_url', 'is', null)
        .gte('film_count', 2)
        .lte('film_count', 12)
        .order('profile_completeness', { ascending: false })
        .limit(limit * 2);

      const filtered = (people || []).filter((p) => {
        return !!p.photo_url && (!!p.bio || (p.professions && p.professions.length > 0));
      });

      const enriched = await enrichPeopleCandidates(filtered.slice(0, limit));

      return enriched.map((p) => ({
        id: p.id,
        type: 'person',
        name: p.name,
        subtext: `${p.film_count || 0} credits • ${p.country || 'Nollywood'} • ✨ Rising Star`,
        imageUrl: p.photo_cutout_url || p.photo_url,
        country: p.country,
        category: 'Rising Star',
        completenessScore: p.profile_completeness || (p.bio ? 0.9 : 0.75),
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

    // ── CREW & BEHIND THE CAMERA (DP, Writer, Director, Editor, Sound, Costume) ──
    case 'behind_the_camera': {
      const { data: crew } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, country, film_count, professions, bio, profile_completeness, known_for_department, instagram_url, twitter_url')
        .not('photo_url', 'is', null)
        .gte('film_count', 1)
        .order('profile_completeness', { ascending: false })
        .limit(limit * 3);

      const craftCrew = (crew || []).filter((p) => {
        const profs = (p.professions || []).map((pr: string) => pr.toLowerCase());
        const dept = (p.known_for_department || '').toLowerCase();
        return (
          profs.some((pr: string) =>
            pr.includes('cinematograph') ||
            pr.includes('camera') ||
            pr.includes('director of photography') ||
            pr.includes('writer') ||
            pr.includes('screenplay') ||
            pr.includes('director') ||
            pr.includes('editor') ||
            pr.includes('costume') ||
            pr.includes('sound') ||
            pr.includes('producer')
          ) ||
          dept.includes('camera') ||
          dept.includes('writing') ||
          dept.includes('directing') ||
          dept.includes('editing') ||
          dept.includes('sound') ||
          dept.includes('costume')
        );
      });

      const enriched = await enrichPeopleCandidates(craftCrew.slice(0, limit));

      return enriched.map((p) => {
        const department = classifyCrewDepartment(p.professions, p.known_for_department);
        return {
          id: p.id,
          type: 'person',
          name: p.name,
          subtext: `${department} • ${p.country || 'African Cinema'} • 🎬 Craft Spotlight`,
          imageUrl: p.photo_cutout_url || p.photo_url,
          country: p.country,
          category: department,
          completenessScore: p.profile_completeness || 0.85,
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

    // ── FILMOGRAPHY / CAREER DEEP DIVES ──────────────────────────────────────
    case 'filmography':
    case 'stage_to_screen':
    case 'birthday_spotlight': {
      const { data: people } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, country, film_count, professions, bio, profile_completeness, instagram_url, twitter_url, date_of_birth')
        .not('photo_url', 'is', null)
        .gte('film_count', 3)
        .order('film_count', { ascending: false })
        .limit(limit * 2);

      const enriched = await enrichPeopleCandidates((people || []).slice(0, limit));

      return enriched.map((p) => ({
        id: p.id,
        type: 'person',
        name: p.name,
        subtext: `${p.film_count || 0} credits • ${p.country || 'African Cinema'}`,
        imageUrl: p.photo_cutout_url || p.photo_url,
        country: p.country,
        category: (p.professions || [])[0] || 'Filmmaker',
        completenessScore: p.profile_completeness || 0.8,
        data: {
          ...p,
          handle: extractSocialHandle(p),
        },
      }));
    }

    // ── WHERE TO WATCH & WEEKEND WATCHLIST (Emerging Platforms + YouTube Gems + Streamers) ──
    case 'where_to_watch':
    case 'weekend_watchlist': {
      const candidates: any[] = [];

      // 1. Fetch Emerging Platform Releases (Nollistream, Docuth, EbonyLife, Kava, Circuits)
      const { data: emergingFilms } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, release_type, streaming_links, youtube_watch_url, liked_percent, imdb_rating, synopsis, tagline, genres')
        .not('poster_url', 'is', null)
        .in('release_type', EMERGING_PLATFORMS)
        .order('year', { ascending: false })
        .limit(limit);

      (emergingFilms || []).forEach((f) => {
        const platformName = PLATFORM_DISPLAY_NAMES[f.release_type || ''] || 'African Platform';
        candidates.push({
          id: f.id,
          type: 'movie',
          name: f.title,
          subtext: `Stream on ${platformName} • ${f.year || 'New'}`,
          imageUrl: f.poster_url,
          completenessScore: f.poster_url ? 0.95 : 0.6,
          category: platformName,
          data: {
            ...f,
            isEmergingPlatform: true,
            platform: f.release_type,
            platformDisplayName: platformName,
          },
        });
      });

      // 2. Fetch YouTube Titles & compute Outperformance / Hidden Gem scores
      const { data: ytFilms } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, release_type, youtube_watch_url, liked_percent, imdb_rating, synopsis, tagline, genres, youtube_stats(*)')
        .not('poster_url', 'is', null)
        .not('youtube_watch_url', 'is', null)
        .order('year', { ascending: false })
        .limit(limit);

      (ytFilms || []).forEach((f: any) => {
        const stats = Array.isArray(f.youtube_stats) ? f.youtube_stats[0] : f.youtube_stats;
        const views = stats?.view_count || 0;
        const likes = stats?.like_count || 0;
        const likedPct = f.liked_percent || 70;
        const outperformanceRatio = views > 0 ? views / 25000 : 0;
        const isYoutubeGem = (outperformanceRatio >= 1.2 || (views >= 30000 && (likes / Math.max(views, 1)) > 0.035)) && likedPct >= 65;

        candidates.push({
          id: f.id,
          type: 'movie',
          name: f.title,
          subtext: isYoutubeGem
            ? `💎 YouTube Gem (${Math.max(1, outperformanceRatio).toFixed(1)}x Reach) • ${f.year || 'Nollywood'}`
            : `YouTube Nollywood • ${f.year || 'Trending'}`,
          imageUrl: f.poster_url,
          completenessScore: 0.9,
          category: isYoutubeGem ? 'YouTube Hidden Gem' : 'YouTube Nollywood',
          data: {
            ...f,
            isYoutubeGem,
            outperformanceRatio: Number(outperformanceRatio.toFixed(2)),
            views,
            likes,
            platform: 'youtube',
            platformDisplayName: 'YouTube',
          },
        });
      });

      // 3. Fetch Mainstream Streamers & Cinema (Netflix, Prime Video, In Cinemas)
      const { data: mainstreamFilms } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, release_type, is_in_cinemas, liked_percent, imdb_rating, synopsis, tagline, genres, streaming_links')
        .not('poster_url', 'is', null)
        .or('is_in_cinemas.eq.true,release_type.in.(netflix,prime_video)')
        .order('year', { ascending: false })
        .limit(limit);

      (mainstreamFilms || []).forEach((f) => {
        const platformLabel = f.is_in_cinemas
          ? 'In Cinemas'
          : PLATFORM_DISPLAY_NAMES[f.release_type || ''] || 'Streaming';
        candidates.push({
          id: f.id,
          type: 'movie',
          name: f.title,
          subtext: `${platformLabel} • ${f.year || 'Feature'}`,
          imageUrl: f.poster_url,
          completenessScore: 0.85,
          category: f.is_in_cinemas ? 'In Cinemas' : platformLabel,
          data: {
            ...f,
            isMainstream: true,
            platform: f.is_in_cinemas ? 'cinema' : f.release_type,
            platformDisplayName: platformLabel,
          },
        });
      });

      const enriched = await enrichFilmCandidates(candidates.map(c => ({ ...c.data, candidateId: c.id })));
      return candidates.slice(0, limit).map((c, i) => ({
        ...c,
        data: {
          ...c.data,
          topCast: enriched[i]?.topCast || [],
          directors: enriched[i]?.directors || [],
        },
      }));
    }

    // ── CRITICS ROUNDUP & VERDICTS (Real movies with critic reviews) ────────
    case 'critics_say':
    case 'the_critic':
    case 'one_film_two_takes': {
      // 1. First priority: Films with actual verified critic reviews & quotes
      const { data: reviews } = await supabase
        .from('critic_reviews')
        .select('id, film_id, critic_name, publication, quote, rating, films!inner(id, title, slug, poster_url, backdrop_url, release_date, year, synopsis, tagline, liked_percent, imdb_rating, genres)')
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

      // 2. Fallback: Top-rated films with audience/critic reception
      const { data: films } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, synopsis, tagline, liked_percent, imdb_rating, genres, release_type, streaming_links, is_in_cinemas')
        .not('poster_url', 'is', null)
        .order('liked_percent', { ascending: false, nullsFirst: false })
        .limit(limit);

      const enriched = await enrichFilmCandidates(films || []);

      return enriched.map((f: any) => ({
        id: f.id,
        type: 'movie' as const,
        name: f.title,
        subtext: `⭐ ${f.liked_percent ? `${f.liked_percent}% Audience Rating` : `${f.year || 'Feature Film'}`} • Critical Reception`,
        imageUrl: f.poster_url,
        country: 'Nollywood',
        category: 'Critic Verdict',
        completenessScore: 0.85,
        data: {
          ...f,
          isCriticFeatured: true,
        },
      }));
    }

    // ── THEATRE & LIVE STAGE ────────────────────────────────────────────────
    case 'whats_on_stage':
    case 'theatre_spotlight': {
      const { data: plays } = await supabase
        .from('plays')
        .select('id, title, slug, venue, city, country, run_start_date, run_end_date, poster_url, status, synopsis, playwright')
        .order('run_start_date', { ascending: false })
        .limit(limit);

      return (plays || []).map((p) => ({
        id: p.id,
        type: 'play',
        name: p.title,
        subtext: `${p.venue || 'Stage'} • ${p.city || 'Lagos'} (${p.status || 'upcoming'})`,
        imageUrl: p.poster_url,
        country: p.country,
        category: 'Theatre',
        completenessScore: 0.85,
        data: p,
      }));
    }

    // ── NEW & UPCOMING (Trailer Drops, Video Clips, Announcements) ───────────
    case 'new_and_upcoming': {
      const { data: films } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, is_in_cinemas, youtube_watch_url, trailer_youtube_id, liked_percent, synopsis, tagline, genres, streaming_links')
        .not('poster_url', 'is', null)
        .or('trailer_youtube_id.not.is.null,youtube_watch_url.not.is.null,is_in_cinemas.eq.true')
        .order('year', { ascending: false })
        .limit(limit);

      const enriched = await enrichFilmCandidates(films || []);

      return enriched.map((f: any) => ({
        id: f.id,
        type: 'movie' as const,
        name: f.title,
        subtext: f.trailer_youtube_id ? '🎬 Official Trailer Available' : '🎥 Scene Clip Available',
        imageUrl: f.poster_url,
        completenessScore: 0.9,
        category: 'New & Upcoming',
        data: {
          ...f,
          isVideoCandidate: true,
        },
      }));
    }

    // ── DEFAULT FALLBACK (Film Conversation / Nollywood Debate) ─────────────
    default: {
      const { data: films } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, year, release_date, synopsis, tagline, genres, liked_percent, streaming_links, is_in_cinemas')
        .not('poster_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      const enriched = await enrichFilmCandidates(films || []);

      return enriched.map((f: any) => ({
        id: f.id,
        type: 'movie' as const,
        name: f.title,
        subtext: `${f.year || 'Film'} • Nollywood Discussion`,
        imageUrl: f.poster_url,
        completenessScore: 0.8,
        category: 'Nollywood Spotlight',
        data: f,
      }));
    }
  }
}


