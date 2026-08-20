import { createClient } from '@supabase/supabase-js';

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
 * Fetch candidate entities for a given content series from MuviDB Postgres tables.
 */
export async function fetchSeriesCandidates(seriesSlug: string, limit = 30): Promise<CandidateEntity[]> {
  switch (seriesSlug) {
    // ── RISING STARS & SUPPORTING ACTORS (No superstar bias) ───────────────
    case 'you_know_the_face': {
      // Fetch actors with 2 to 10 credits (supporting & fresh faces), complete profiles, and photos
      const { data: people } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, country, film_count, professions, bio, profile_completeness, popularity_score, instagram_url, twitter_url')
        .not('photo_url', 'is', null)
        .gte('film_count', 2)
        .lte('film_count', 10)
        .order('profile_completeness', { ascending: false })
        .limit(limit * 2);

      const filtered = (people || []).filter((p) => {
        // Must have photo and non-empty bio or professions
        return !!p.photo_url && (!!p.bio || (p.professions && p.professions.length > 0));
      });

      return filtered.slice(0, limit).map((p) => ({
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

      return craftCrew.slice(0, limit).map((p) => {
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
    case 'stage_to_screen': {
      const { data: people } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, photo_cutout_url, country, film_count, professions, bio, profile_completeness')
        .not('photo_url', 'is', null)
        .gte('film_count', 4)
        .order('film_count', { ascending: false })
        .limit(limit * 2);

      return (people || []).map((p) => ({
        id: p.id,
        type: 'person',
        name: p.name,
        subtext: `${p.film_count || 0} credits • ${p.country || 'African Cinema'}`,
        imageUrl: p.photo_cutout_url || p.photo_url,
        country: p.country,
        category: (p.professions || [])[0] || 'Filmmaker',
        completenessScore: p.profile_completeness || 0.8,
        data: p,
      }));
    }

    // ── WHERE TO WATCH & WEEKEND WATCHLIST (Emerging Platforms + YouTube Gems + Streamers) ──
    case 'where_to_watch':
    case 'weekend_watchlist': {
      const candidates: CandidateEntity[] = [];

      // 1. Fetch Emerging Platform Releases (Nollistream, Docuth, EbonyLife, Kava, Circuits)
      const { data: emergingFilms } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, release_type, streaming_links, youtube_watch_url, liked_percent, imdb_rating, synopsis')
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
          category: 'Emerging Platform',
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
        .select('id, title, slug, poster_url, release_date, year, release_type, youtube_watch_url, liked_percent, youtube_stats(*)')
        .not('poster_url', 'is', null)
        .not('youtube_watch_url', 'is', null)
        .order('year', { ascending: false })
        .limit(limit);

      (ytFilms || []).forEach((f: any) => {
        const stats = Array.isArray(f.youtube_stats) ? f.youtube_stats[0] : f.youtube_stats;
        const views = stats?.view_count || 0;
        const likes = stats?.like_count || 0;
        const comments = stats?.comment_count || 0;
        const likedPct = f.liked_percent || 70;

        // Approximate Outperformance heuristic (assuming average indie channel has ~25k subs)
        const estimatedSubBase = 25000;
        const outperformanceRatio = views > 0 ? views / estimatedSubBase : 0;
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
            comments,
            platform: 'youtube',
            platformDisplayName: 'YouTube',
          },
        });
      });

      // 3. Fetch Mainstream Streamers & Cinema (Netflix, Prime Video, In Cinemas)
      const { data: mainstreamFilms } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, release_date, year, release_type, is_in_cinemas, liked_percent, imdb_rating')
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
          category: f.is_in_cinemas ? 'Cinema' : 'Mainstream Streamer',
          data: {
            ...f,
            isMainstream: true,
            platform: f.is_in_cinemas ? 'cinema' : f.release_type,
            platformDisplayName: platformLabel,
          },
        });
      });

      // Sort with priority: Emerging Platforms & Hidden Gems + High Star Ratings
      candidates.sort((a, b) => {
        const aStar = Number(a.data?.imdb_rating || (a.data?.liked_percent ? a.data.liked_percent / 10 : 0));
        const bStar = Number(b.data?.imdb_rating || (b.data?.liked_percent ? b.data.liked_percent / 10 : 0));
        const aBoost = (a.data?.isEmergingPlatform ? 3 : (a.data?.isYoutubeGem ? 2.5 : 1)) + (aStar >= 7.0 ? 1.5 : (aStar >= 6.0 ? 0.5 : 0));
        const bBoost = (b.data?.isEmergingPlatform ? 3 : (b.data?.isYoutubeGem ? 2.5 : 1)) + (bStar >= 7.0 ? 1.5 : (bStar >= 6.0 ? 0.5 : 0));
        return bBoost - aBoost;
      });

      return candidates.slice(0, limit);
    }

    // ── CRITICS ROUNDUP & VERDICTS ──────────────────────────────────────────
    case 'critics_say':
    case 'the_critic':
    case 'one_film_two_takes': {
      const { data: critics } = await supabase
        .from('critics')
        .select('id, name, slug, publication, avatar_url, bio, is_verified')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (critics && critics.length > 0) {
        return critics.map((c) => ({
          id: c.id,
          type: 'critic',
          name: c.name,
          subtext: `${c.publication || 'Film Critic'}`,
          imageUrl: c.avatar_url,
          completenessScore: 0.85,
          data: c,
        }));
      }

      // Fallback to films with critic reviews
      const { data: reviews } = await supabase
        .from('critic_reviews')
        .select('id, film_id, critic_name, publication, quote, rating, films(id, title, poster_url)')
        .limit(limit);

      return (reviews || []).map((r: any) => ({
        id: r.films?.id || r.id,
        type: 'movie',
        name: r.films?.title || 'Critic Reviewed Film',
        subtext: `Reviewed by ${r.critic_name || 'Critic'} (${r.publication || 'Review'})`,
        imageUrl: r.films?.poster_url,
        completenessScore: 0.8,
        data: r,
      }));
    }

    // ── THEATRE & LIVE STAGE ────────────────────────────────────────────────
    case 'whats_on_stage':
    case 'theatre_spotlight': {
      const { data: plays } = await supabase
        .from('plays')
        .select('id, title, slug, venue, city, country, run_start_date, run_end_date, poster_url, status')
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
        .select('id, title, slug, poster_url, backdrop_url, release_date, year, is_in_cinemas, youtube_watch_url, trailer_youtube_id, liked_percent')
        .not('poster_url', 'is', null)
        .or('trailer_youtube_id.not.is.null,youtube_watch_url.not.is.null,is_in_cinemas.eq.true')
        .order('year', { ascending: false })
        .limit(limit);

      return (films || []).map((f) => ({
        id: f.id,
        type: 'movie',
        name: f.title,
        subtext: f.trailer_youtube_id ? '🎬 Trailer Available' : '🎥 Scene Clip Available',
        imageUrl: f.poster_url,
        completenessScore: 0.9,
        category: 'Video Snippet',
        data: {
          ...f,
          isVideoCandidate: true,
        },
      }));
    }

    // ── DEFAULT FALLBACK ────────────────────────────────────────────────────
    default: {
      const { data: films } = await supabase
        .from('films')
        .select('id, title, poster_url, year')
        .order('created_at', { ascending: false })
        .limit(limit);

      return (films || []).map((f) => ({
        id: f.id,
        type: 'movie',
        name: f.title,
        subtext: `${f.year || 'Film'}`,
        imageUrl: f.poster_url,
        completenessScore: 0.7,
        data: f,
      }));
    }
  }
}

