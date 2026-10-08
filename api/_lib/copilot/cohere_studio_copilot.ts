import dotenv from 'dotenv';
import { supabase } from '../supabase.js';
import {
  createUniversalSocialPost,
  generateSocialDraft,
  scheduleContentItem,
  reviewContentItem,
  defaultContentTypeForSeries,
  defaultTemplateSlugForSeries,
} from '../social_studio.js';
import { searchCandidates, derivePlayStatus } from '../editorial/candidate_service.js';
import { isLikelyLandscapeOrThumbnailUrl, resolveFilmPlatform } from '../editorial/candidate_strategy.js';

dotenv.config();

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

async function checkPosterIsPortrait(url: string | null | undefined): Promise<boolean> {
  if (!url || typeof url !== 'string' || !url.trim()) return false;
  // Fast negative filter: reject YouTube 16:9 thumbnails and landscape banner markers
  if (isLikelyLandscapeOrThumbnailUrl(url)) return false;
  try {
    const cleanUrl = url.trim();
    const res = await fetch(cleanUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return !isLikelyLandscapeOrThumbnailUrl(cleanUrl);
    const buf = Buffer.from(await res.arrayBuffer());
    const sharp = (await import('sharp')).default;
    const m = await sharp(buf).metadata();
    const width = m.width || 0;
    const height = m.height || 0;
    return height > width && width >= 300;
  } catch {
    return !isLikelyLandscapeOrThumbnailUrl(url);
  }
}

function collectKeys(base: string): string[] {
  const raw: (string | undefined)[] = [process.env[base]];
  for (let i = 2; i <= 10; i++) raw.push(process.env[`${base}_${i}`]);
  return [
    ...new Set(
      raw.filter(Boolean).flatMap((k) => k!.split(',')).map((k) => k.trim()).filter(Boolean)
    ),
  ];
}

const COHERE_KEYS = collectKeys('COHERE_API_KEY');
let cohereKeyIdx = 0;
const COHERE_CHAT_MODEL = process.env.COHERE_CHAT_MODEL || 'command-r-08-2024';

let _CohereClient: any = null;
async function getCohereClient() {
  if (!_CohereClient) {
    const mod = await import('cohere-ai');
    _CohereClient = (mod as any).CohereClient || (mod as any).default;
  }
  const key = COHERE_KEYS[cohereKeyIdx] || '';
  if (!key) throw new Error('COHERE_API_KEY is not configured');
  return new _CohereClient({ token: key });
}

function isCohereQuotaOrDeadError(err: any): boolean {
  const status = err?.statusCode ?? err?.status;
  const msg = (err?.message || '').toLowerCase();
  return (
    status === 429 ||
    status === 401 ||
    status === 403 ||
    status === 502 ||
    status === 503 ||
    /quota|rate limit|too many requests|unauthorized|forbidden|\b429\b|\b401\b|\b403\b|fetch failed|socket|network|econnreset|etimedout/.test(msg)
  );
}

async function withCohereKeyRotation<T>(fn: (client: any) => Promise<T>): Promise<T> {
  let lastErr: any;
  const attempts = Math.max(2, COHERE_KEYS.length * 2);
  for (let i = 0; i < attempts; i++) {
    try {
      const client = await getCohereClient();
      return await fn(client);
    } catch (err: any) {
      lastErr = err;
      if (isCohereQuotaOrDeadError(err)) {
        console.warn(`[Cohere Copilot] Key #${cohereKeyIdx + 1} quota/network error (${err?.message}), rotating/retrying...`);
        if (COHERE_KEYS.length > 1) {
          cohereKeyIdx = (cohereKeyIdx + 1) % COHERE_KEYS.length;
        }
        await new Promise((resolve) => setTimeout(resolve, 800));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

export const COPILOT_TOOLS = [
  {
    name: 'search_database',
    description: 'Search MuviDB database for movies, actors, filmmakers, critics, or stage plays.',
    parameterDefinitions: {
      query: {
        description: 'The search query string (e.g. film title, actor name, or keyword)',
        type: 'str',
        required: true,
      },
      type: {
        description: 'Filter category: "movie", "person", "critic", "play", or "all"',
        type: 'str',
        required: false,
      },
      limit: {
        description: 'Maximum number of results to return (default: 5)',
        type: 'int',
        required: false,
      },
    },
  },
  {
    name: 'get_film_details',
    description: 'Fetch detailed information about a specific movie: synopsis, release dates, platforms (Netflix, Prime, YouTube, Cinemas), genres, ratings, and cast & crew with their character names and social handles.',
    parameterDefinitions: {
      film_id: {
        description: 'The UUID of the film (if known)',
        type: 'str',
        required: false,
      },
      title: {
        description: 'The title of the film to look up',
        type: 'str',
        required: false,
      },
    },
  },
  {
    name: 'get_person_details',
    description: 'Fetch detailed biography, filmography, credits count, awards, and social media handles (@Instagram, Twitter) for an actor or filmmaker.',
    parameterDefinitions: {
      person_id: {
        description: 'The UUID of the person (if known)',
        type: 'str',
        required: false,
      },
      name: {
        description: 'The name of the actor or filmmaker',
        type: 'str',
        required: false,
      },
    },
  },
  {
    name: 'get_critic_reviews',
    description: 'Fetch verified Nollywood critic reviews (e.g. Film Efiko, WKMUP, Cinema Pointer) including ratings, quotes, and publication names.',
    parameterDefinitions: {
      film_id: {
        description: 'The UUID of the film',
        type: 'str',
        required: false,
      },
      film_title: {
        description: 'The title of the film to find reviews for',
        type: 'str',
        required: false,
      },
      critic_name: {
        description: 'Optional filter by critic or publication name',
        type: 'str',
        required: false,
      },
    },
  },
  {
    name: 'get_stage_plays',
    description: 'Fetch Nigerian theatre and stage plays: upcoming productions, currently running plays, venues (e.g. Terra Kulture, Muson Centre), playwrights, and dates.',
    parameterDefinitions: {
      upcoming_only: {
        description: 'If true, returns only upcoming or currently running plays (default: true)',
        type: 'bool',
        required: false,
      },
      city: {
        description: 'Filter by city (e.g. Lagos, Abuja)',
        type: 'str',
        required: false,
      },
    },
  },
  {
    name: 'create_social_draft',
    description: 'Create a social media post in Social Studio draft queue. Can target Instagram, Threads, Facebook, TikTok, and X. Can also schedule the post for a future date/time.',
    parameterDefinitions: {
      title: {
        description: 'A headline or internal title for the post',
        type: 'str',
        required: true,
      },
      caption: {
        description: 'The main social media copy/caption. Include proper @handles for actors/directors, engaging hooks, and relevant hashtags.',
        type: 'str',
        required: true,
      },
      platforms: {
        description: 'Comma-separated platforms: "instagram,threads,facebook,tiktok,x"',
        type: 'str',
        required: false,
      },
      content_type: {
        description: 'Content category: "actor_spotlight", "upcoming_movie", "critics_say", "where_to_watch", "whats_on_stage", "weekend_watchlist", or "film_conversation"',
        type: 'str',
        required: false,
      },
      source_entity_id: {
        description: 'Optional UUID of the film, person, or play being featured',
        type: 'str',
        required: false,
      },
      media_url: {
        description: 'Optional image or poster URL to attach to the post',
        type: 'str',
        required: false,
      },
      schedule_for: {
        description: 'Optional ISO date-time string to schedule this post (e.g. "2026-10-05T18:00:00Z"). If omitted, it is saved as a draft.',
        type: 'str',
        required: false,
      },
    },
  },
  {
    name: 'query_editorial_calendar',
    description: 'Check scheduled posts and available slots in the Social Studio calendar for upcoming days.',
    parameterDefinitions: {
      days: {
        description: 'Number of upcoming days to inspect (default: 7)',
        type: 'int',
        required: false,
      },
    },
  },
  {
    name: 'get_latest_films',
    description: 'Fetch the latest Nollywood and African movies from MuviDB, filtered by destination (YouTube, streaming platforms such as NolliStream, Docuth, EbonyLife, Netflix, Prime Video, or Cinemas) with verified portrait posters (strictly excluding landscape 16:9 YouTube video thumbnails or wide backdrops).',
    parameterDefinitions: {
      platform: {
        description: 'Filter destination: "all", "youtube", "streaming", or "cinema" (default: "all")',
        type: 'str',
        required: false,
      },
      limit: {
        description: 'Maximum number of films to return (default: 5)',
        type: 'int',
        required: false,
      },
      require_portrait_poster: {
        description: 'If true (default), strictly filters for films with verified vertical portrait posters (height > width, not a landscape video thumbnail)',
        type: 'bool',
        required: false,
      },
      days: {
        description: 'Optional filter: only include films released or updated within the last N days (e.g. 30)',
        type: 'int',
        required: false,
      },
    },
  },
  {
    name: 'batch_schedule_posts',
    description: 'Batch schedule or draft social media posts for multiple movies or stage plays into upcoming Social Studio calendar slots. Automatically formats engaging Nollywood captions, handles actor/director credits and @handles, uses verified portrait posters, and assigns optimal posting slots (e.g., 09:00 WAT, 12:00 WAT, 15:30 WAT, 18:00 WAT, 20:30 WAT) starting from today or tomorrow.',
    parameterDefinitions: {
      film_ids: {
        description: 'Array or comma-separated UUIDs of the films to schedule',
        type: 'str',
        required: true,
      },
      start_date: {
        description: 'Optional date to start scheduling from (YYYY-MM-DD). If omitted, starts from tomorrow.',
        type: 'str',
        required: false,
      },
      platforms: {
        description: 'Comma-separated target platforms: "instagram,threads,facebook,tiktok" (default: all four)',
        type: 'str',
        required: false,
      },
      status: {
        description: '"scheduled" (default) or "draft"',
        type: 'str',
        required: false,
      },
    },
  },
];

export async function executeCopilotTool(
  toolName: string,
  params: Record<string, any>,
  actor: { id: string; email?: string; [key: string]: any },
): Promise<any> {
  switch (toolName) {
    case 'search_database': {
      const q = String(params.query || '').trim();
      const type = (params.type || 'all') as any;
      const limit = Number(params.limit || 5);
      const isGeneric = !q || /^(popular|top|actors?|actress|actresses|movies?|films?|latest|new|all|famous|spotlight)$/i.test(q);

      let results: any[] = [];
      if (!isGeneric) {
        results = await searchCandidates(q, type, limit);
      }

      // If generic discovery or no direct match, provide top relevant records
      if (results.length === 0) {
        if (type === 'all' || type === 'person') {
          const { data: topPeople } = await supabase
            .from('people')
            .select('id, name, slug, photo_url, photo_cutout_url, nationality, film_count, known_for_department, instagram_url')
            .order('film_count', { ascending: false })
            .limit(limit);
          if (topPeople) {
            results.push(
              ...topPeople.map((p) => ({
                id: p.id,
                type: 'person' as const,
                name: p.name,
                subtext: `${p.film_count || 0} credits • ${p.nationality || 'Nollywood'} • ${p.known_for_department || 'Talent'}`,
                imageUrl: p.photo_cutout_url || p.photo_url,
                category: p.known_for_department || 'Actor Spotlight',
                data: {
                  handle: p.instagram_url,
                  creditCount: p.film_count,
                },
              })),
            );
          }
        }
        if (type === 'all' || type === 'movie') {
          const { data: topFilms } = await supabase
            .from('films')
            .select('id, title, slug, poster_url, release_date, year, is_in_cinemas, coming_soon, genres')
            .order('year', { ascending: false })
            .limit(limit);
          if (topFilms) {
            results.push(
              ...topFilms.map((f) => ({
                id: f.id,
                type: 'movie' as const,
                name: f.title,
                subtext: `${f.year || 'Film'} • ${(f.genres || []).slice(0, 2).join(', ') || 'Nollywood'}`,
                imageUrl: f.poster_url,
                category: f.coming_soon ? 'Coming Soon' : f.is_in_cinemas ? 'In Cinemas' : 'Catalogue',
                data: {
                  year: f.year,
                },
              })),
            );
          }
        }
      }

      return results.slice(0, limit).map((r) => ({
        id: r.id,
        type: r.type,
        name: r.name,
        subtext: r.subtext,
        imageUrl: r.imageUrl,
        category: r.category,
        data: {
          platform: r.data?.platformDisplayName || r.data?.platform,
          year: r.data?.year,
          handle: r.data?.handle,
          creditCount: r.data?.creditCount,
        },
      }));
    }

    case 'get_film_details': {
      let query = supabase
        .from('films')
        .select(`
          id, title, slug, year, synopsis, tagline, poster_url, backdrop_url,
          release_date, release_type, is_in_cinemas, coming_soon,
          streaming_links, youtube_watch_url, trailer_youtube_id, trailer_external_url,
          genres, liked_percent, imdb_rating,
          credits (
            id, role, character_name, billing_order,
            people ( id, name, instagram_url, twitter_url, photo_url )
          )
        `);

      if (params.film_id) {
        query = query.eq('id', params.film_id);
      } else if (params.title) {
        query = query.ilike('title', `%${params.title.trim()}%`);
      } else {
        return { error: 'Please provide either film_id or title' };
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: `No film found matching "${params.title || params.film_id}"` };

      const castAndCrew = (data.credits || []).map((c: any) => ({
        name: c.people?.name,
        role: c.role,
        character: c.character_name,
        instagram: c.people?.instagram_url,
        twitter: c.people?.twitter_url,
      }));

      return {
        id: data.id,
        title: data.title,
        year: data.year,
        synopsis: data.synopsis,
        tagline: data.tagline,
        release_date: data.release_date,
        is_in_cinemas: data.is_in_cinemas,
        coming_soon: data.coming_soon,
        poster_url: data.poster_url,
        streaming_links: data.streaming_links,
        youtube_watch_url: data.youtube_watch_url,
        genres: data.genres,
        imdb_rating: data.imdb_rating,
        top_cast_and_crew: castAndCrew.slice(0, 10),
      };
    }

    case 'get_person_details': {
      let query = supabase
        .from('people')
        .select(`
          id, name, slug, photo_url, photo_cutout_url, nationality,
          bio, film_count, profile_views, known_for_department,
          instagram_url, twitter_url,
          credits (
            id, role, character_name,
            films ( id, title, year, poster_url )
          )
        `);

      if (params.person_id) {
        query = query.eq('id', params.person_id);
      } else if (params.name) {
        query = query.ilike('name', `%${params.name.trim()}%`);
      } else {
        return { error: 'Please provide either person_id or name' };
      }

      const { data, error } = await query.limit(1).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { error: `No person found matching "${params.name || params.person_id}"` };

      const credits = (data.credits || [])
        .map((c: any) => ({
          film_title: c.films?.title,
          year: c.films?.year,
          role: c.role,
          character: c.character_name,
        }))
        .filter((c: any) => c.film_title)
        .slice(0, 15);

      return {
        id: data.id,
        name: data.name,
        nationality: data.nationality,
        bio: data.bio,
        film_count: data.film_count || credits.length,
        known_for: data.known_for_department || 'Actor & Filmmaker',
        photo_url: data.photo_cutout_url || data.photo_url,
        social_handles: {
          instagram: data.instagram_url,
          twitter: data.twitter_url,
        },
        recent_filmography: credits,
      };
    }

    case 'get_critic_reviews': {
      let query = supabase
        .from('critic_reviews')
        .select('id, film_id, critic_name, critic_title, quote, rating, review_url, is_featured, films(id, title, year, poster_url)');

      if (params.film_id) {
        query = query.eq('film_id', params.film_id);
      } else if (params.film_title) {
        const { data: matchedFilms } = await supabase
          .from('films')
          .select('id')
          .ilike('title', `%${params.film_title.trim()}%`)
          .limit(3);
        const fIds = (matchedFilms || []).map((f) => f.id);
        if (fIds.length) {
          query = query.in('film_id', fIds);
        } else {
          return { error: `No film found matching "${params.film_title}"` };
        }
      }

      if (params.critic_name) {
        query = query.ilike('critic_name', `%${params.critic_name.trim()}%`);
      }

      const { data, error } = await query.order('rating', { ascending: false }).limit(10);
      if (error) return { error: error.message };
      return (data || []).map((r: any) => ({
        id: r.id,
        film_title: r.films?.title,
        critic: r.critic_name,
        title: r.critic_title,
        quote: r.quote,
        rating: r.rating,
        review_url: r.review_url,
      }));
    }

    case 'get_stage_plays': {
      const todayStr = new Date().toISOString().slice(0, 10);
      let query = supabase
        .from('plays')
        .select('id, title, slug, poster_url, venue, city, country, run_start_date, run_end_date, synopsis, status, playwright, director, ticket_link');

      if (params.city) {
        query = query.ilike('city', `%${params.city.trim()}%`);
      }

      const { data, error } = await query.order('run_start_date', { ascending: false }).limit(15);
      if (error) return { error: error.message };

      const plays = (data || []).map((pl) => ({
        ...pl,
        live_status: derivePlayStatus(pl),
      }));

      if (params.upcoming_only !== false) {
        return plays.filter((pl) => pl.live_status === 'upcoming' || pl.live_status === 'currently_running');
      }
      return plays;
    }

    case 'create_social_draft': {
      const title = String(params.title || 'Social Post').trim();
      const caption = String(params.caption || '').trim();
      const VALID_PLATFORMS = new Set(['instagram', 'facebook', 'threads', 'tiktok', 'youtube']);
      const rawPlatforms = String(params.platforms || 'instagram,threads,facebook,tiktok')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .map((p) => (p === 'x' || p === 'twitter' ? 'threads' : p))
        .filter((p) => VALID_PLATFORMS.has(p));
      const finalPlatforms = rawPlatforms.length ? rawPlatforms : ['instagram', 'threads'];

      const mediaAssets = params.media_url ? [{ publicUrl: params.media_url }] : undefined;
      const scheduledFor = params.schedule_for || null;
      const status = scheduledFor ? 'scheduled' : 'draft';

      const result = await createUniversalSocialPost(
        {
          title,
          universalCaption: caption,
          platforms: finalPlatforms,
          mediaAssets,
          scheduledFor,
          status,
        },
        actor as any,
      );

      const contentItemId = (result as any).contentItemId || (result as any).id;

      return {
        success: true,
        message: scheduledFor
          ? `Post scheduled successfully for ${new Date(scheduledFor).toLocaleString('en-NG')}`
          : 'Post saved to drafts queue successfully',
        content_item_id: contentItemId,
        title,
        platforms: finalPlatforms,
        status,
        scheduled_for: scheduledFor,
      };
    }

    case 'query_editorial_calendar': {
      const days = Number(params.days || 7);
      const { data: items } = await supabase
        .from('social_content_items')
        .select(`
          id, title, content_type, status, created_at,
          social_platform_variants ( platform, status, scheduled_for, caption )
        `)
        .in('status', ['draft', 'approved', 'scheduled'])
        .order('created_at', { ascending: true })
        .limit(30);

      return {
        queued_count: (items || []).length,
        items: (items || []).map((item) => ({
          id: item.id,
          title: item.title,
          type: item.content_type,
          status: item.status,
          platforms: (item.social_platform_variants || []).map((v: any) => ({
            platform: v.platform,
            scheduled_for: v.scheduled_for,
          })),
        })),
      };
    }

    case 'get_latest_films': {
      const platformFilter = String(params.platform || 'all').toLowerCase();
      const limit = Math.min(Math.max(Number(params.limit || 5), 1), 20);
      const requirePortrait = params.require_portrait_poster !== false;
      const days = params.days ? Number(params.days) : null;

      const filmSelect = `
        id, title, slug, year, synopsis, tagline, poster_url, backdrop_url,
        release_date, release_type, source, streaming_links, youtube_watch_url,
        genres, imdb_rating, liked_percent, view_count, is_in_cinemas, coming_soon,
        credits (
          id, role, character_name, billing_order,
          people ( id, name, instagram_url, twitter_url )
        )
      `;

      let query = supabase.from('films').select(filmSelect).not('poster_url', 'is', null);

      if (days && days > 0) {
        const cutoffDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
        query = query.gte('release_date', cutoffDate);
      }

      if (platformFilter === 'youtube') {
        query = query.not('youtube_watch_url', 'is', null);
      } else if (platformFilter === 'streaming') {
        query = query.or('release_type.in.(nollistream,docuth,ebonylife,kava,circuits,netflix,prime_video),source.in.(nollistream,docuth,ebonylife,kava,circuits),streaming_links.neq.{}');
      } else if (platformFilter === 'cinema') {
        query = query.or('is_in_cinemas.eq.true,release_type.eq.cinema');
      } else {
        // 'all': YouTube or Streaming platforms
        query = query.or('youtube_watch_url.not.is.null,release_type.neq.cinema,streaming_links.neq.{}');
      }

      // Query candidate pool ordered by newest release date and creation time
      const { data: rawFilms, error } = await query
        .order('release_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit * 5);

      if (error) return { error: error.message };

      const matched: any[] = [];
      for (const film of rawFilms || []) {
        if (requirePortrait) {
          const isPortrait = await checkPosterIsPortrait(film.poster_url);
          if (!isPortrait) continue;
        }

        const platform = resolveFilmPlatform(film);
        const platformName = platform
          ? (PLATFORM_DISPLAY_NAMES[platform] || platform)
          : film.is_in_cinemas
            ? 'In Cinemas'
            : 'Catalogue';

        const topCast = (film.credits || []).map((c: any) => ({
          name: c.people?.name,
          role: c.role,
          handle: c.people?.instagram_url,
        })).slice(0, 4);

        matched.push({
          id: film.id,
          title: film.title,
          year: film.year,
          release_date: film.release_date,
          platform: platformName,
          platform_id: platform,
          poster_url: film.poster_url,
          is_portrait_poster: true,
          synopsis: film.synopsis ? (film.synopsis.slice(0, 180) + '...') : null,
          top_cast: topCast,
          youtube_watch_url: film.youtube_watch_url,
          streaming_links: film.streaming_links,
        });

        if (matched.length >= limit) break;
      }

      return {
        count: matched.length,
        platform_filter: platformFilter,
        require_portrait_poster: requirePortrait,
        films: matched,
      };
    }

    case 'batch_schedule_posts': {
      let rawFilmIds = params.film_ids;
      if (typeof rawFilmIds === 'string') {
        try {
          const parsed = JSON.parse(rawFilmIds);
          if (Array.isArray(parsed)) rawFilmIds = parsed;
          else rawFilmIds = rawFilmIds.split(',').map((s: string) => s.trim());
        } catch {
          rawFilmIds = rawFilmIds.split(',').map((s: string) => s.trim());
        }
      }
      const filmIds: string[] = (Array.isArray(rawFilmIds) ? rawFilmIds : [rawFilmIds]).filter(Boolean);
      if (!filmIds.length) {
        return { error: 'Please provide at least one film_id to schedule' };
      }

      const VALID_PLATFORMS = new Set(['instagram', 'facebook', 'threads', 'tiktok', 'youtube']);
      const rawPlatforms = String(params.platforms || 'instagram,threads,facebook,tiktok')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .map((p) => (p === 'x' || p === 'twitter' ? 'threads' : p))
        .filter((p) => VALID_PLATFORMS.has(p));
      const finalPlatforms: any[] = rawPlatforms.length ? rawPlatforms : ['instagram', 'threads'];

      const status = params.status === 'draft' ? 'draft' : 'scheduled';

      // Schedule start date (tomorrow if omitted)
      const now = new Date();
      let startYear = now.getUTCFullYear();
      let startMonth = now.getUTCMonth();
      let startDay = now.getUTCDate() + 1; // start tomorrow by default

      if (params.start_date && /^\d{4}-\d{2}-\d{2}$/.test(params.start_date)) {
        const parts = params.start_date.split('-').map(Number);
        startYear = parts[0];
        startMonth = parts[1] - 1;
        startDay = parts[2];
      }

      const DAILY_TIMES = ['09:00:00', '12:00:00', '15:30:00', '18:00:00', '20:30:00'];
      const scheduledItems: any[] = [];

      for (let i = 0; i < filmIds.length; i++) {
        const filmId = filmIds[i];
        const dayOffset = Math.floor(i / DAILY_TIMES.length);
        const slotIdx = i % DAILY_TIMES.length;
        const timeSlot = DAILY_TIMES[slotIdx];

        const targetDate = new Date(Date.UTC(startYear, startMonth, startDay + dayOffset));
        const dateStr = targetDate.toISOString().split('T')[0];
        const scheduledFor = `${dateStr}T${timeSlot}+01:00`;

        try {
          const { data: film } = await supabase
            .from('films')
            .select('id, title, poster_url, coming_soon, release_date')
            .eq('id', filmId)
            .maybeSingle();

          if (!film) {
            console.warn(`[Copilot batch_schedule] Film not found: ${filmId}`);
            continue;
          }

          const isUpcoming = film.coming_soon || (film.release_date && new Date(film.release_date).getTime() > Date.now());
          const contentType = isUpcoming ? 'upcoming_movie' : 'where_to_watch';
          const templateSlug = isUpcoming ? 'upcoming-movie-v1' : 'now-showing-cinemas-v1';

          const draft = await generateSocialDraft(
            {
              contentType: contentType as any,
              sourceEntityId: film.id,
              templateSlug,
              platforms: finalPlatforms,
            },
            actor as any,
          );

          const contentItemId = draft.contentItem.id;

          if (status === 'scheduled') {
            await reviewContentItem({ contentItemId, action: 'submit' }, actor as any);
            await reviewContentItem({ contentItemId, action: 'approve' }, actor as any);
            await scheduleContentItem({ contentItemId, scheduledFor }, actor as any);

            await supabase
              .from('social_content_items')
              .update({
                scheduled_for: scheduledFor,
                status: 'scheduled',
                metadata: {
                  scheduled_date: dateStr,
                  scheduled_time: timeSlot,
                  auto_scheduled: true,
                  copilot_scheduled: true,
                },
              })
              .eq('id', contentItemId);
          }

          scheduledItems.push({
            content_item_id: contentItemId,
            title: draft.contentItem.title,
            film_title: film.title,
            status,
            scheduled_for: scheduledFor,
            scheduled_date: dateStr,
            scheduled_time: timeSlot,
            platforms: finalPlatforms,
          });
        } catch (itemErr: any) {
          console.error(`[Copilot batch_schedule] Failed to schedule film ${filmId}:`, itemErr.message);
          scheduledItems.push({
            film_id: filmId,
            error: itemErr.message,
          });
        }
      }

      return {
        success: true,
        count: scheduledItems.filter((s) => !s.error).length,
        status,
        scheduled_items: scheduledItems,
      };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

export type CopilotChatMessage = {
  role: 'USER' | 'CHATBOT' | 'SYSTEM';
  message: string;
};

const SYSTEM_PREAMBLE = `You are MuviDB Social Copilot — the expert Nollywood and African entertainment social media producer and conversational assistant.

Your Capabilities:
1. Search and inspect the database for Nigerian and African films, actors, directors, critic reviews, and stage plays.
2. Formulate witty, culturally resonant, engaging social media copy tailored for Instagram, Threads, TikTok, Facebook, and X.
3. Automatically look up authentic Instagram/Twitter handles (@username) for Nigerian actors and directors from our database and include them in captions.
4. Discover the newest films with verified vertical portrait posters using get_latest_films.
5. Batch schedule or draft social media posts into the Social Studio calendar queue using batch_schedule_posts or create individual posts using create_social_draft.
6. Provide intelligent answers, trivia, release schedules, box office context, and industry insights like a top Nollywood insider.

Handling Scheduling & Portrait Poster Requests:
- When the user asks to schedule posts for the latest YouTube or streaming platform movies with portrait posters:
  Step 1: Call get_latest_films with platform="all" (or "youtube" / "streaming" as requested), limit=5 (or requested count), and require_portrait_poster=true.
  Step 2: Take the returned film IDs and call batch_schedule_posts with status="scheduled" (or "draft" if user asked for drafts).
  Step 3: Respond to the user with a stylish, celebratory confirmation detailing:
    - Each film title and its destination platform (e.g. YouTube, NolliStream, Docuth, Netflix, Prime Video)
    - The scheduled date and time slot for each post
    - Confirmation that each film has a verified crisp portrait poster attached (no 16:9 YouTube video thumbnails or landscape banners)
    - A friendly note that they can view them in the Studio Queue or Calendar tab.

Theatres & Stage Plays Guidelines:
- Remember that in MuviDB, theatre stage plays (What's On Stage) are strictly upcoming or currently running live productions with verified portrait posters, ordered chronologically by nearest performance date. If asked about theatre or stage plays, use get_stage_plays with upcoming_only=true.

Tone & Style:
- Culturally attuned, confident, stylish, and knowledgeable.
- Use natural Nigerian cinematic parlance where appropriate (e.g. Nollywood royalty, cinema blockbuster, stage magic, powerhouse performance).
- Always ensure film titles, actor names, and streaming platform destinations are factually grounded in database queries.`;

export async function runStudioCopilotChat(input: {
  message: string;
  chatHistory?: CopilotChatMessage[];
  actor: { id: string; email?: string; [key: string]: any };
}): Promise<{
  response: string;
  chatHistory: CopilotChatMessage[];
  actionsExecuted: Array<{ tool: string; parameters: any; result: any }>;
}> {
  const userMessage = input.message.trim();
  if (!userMessage) {
    throw new Error('Message cannot be empty');
  }

  const existingHistory = (input.chatHistory || []).map((m) => ({
    role: m.role,
    message: m.message,
  }));

  const actionsExecuted: Array<{ tool: string; parameters: any; result: any }> = [];

  return await withCohereKeyRotation(async (cohere) => {
    // 1. Initial invocation with tools
    let chatRes = await cohere.chat({
      model: COHERE_CHAT_MODEL,
      message: userMessage,
      preamble: SYSTEM_PREAMBLE,
      chatHistory: existingHistory as any,
      tools: COPILOT_TOOLS as any,
      temperature: 0.4,
    });

    let currentHistory = chatRes.chatHistory || [];

    // 2. Multi-turn Tool Calling Loop (up to 4 tool iterations)
    let iterations = 0;
    while (chatRes.toolCalls && chatRes.toolCalls.length > 0 && iterations < 4) {
      iterations++;
      const toolResults = [];

      for (const call of chatRes.toolCalls) {
        const name = call.name;
        const params = call.parameters || {};
        console.log(`[Copilot] Executing tool ${name} with params:`, params);

        let output: any;
        try {
          output = await executeCopilotTool(name, params, input.actor);
          actionsExecuted.push({ tool: name, parameters: params, result: output });
        } catch (toolErr: any) {
          console.error(`[Copilot] Tool ${name} error:`, toolErr.message);
          output = { error: toolErr.message };
          actionsExecuted.push({ tool: name, parameters: params, result: output });
        }

        toolResults.push({
          call,
          outputs: [{ results: output }],
        });
      }

      // Send tool results back to Cohere
      chatRes = await cohere.chat({
        model: COHERE_CHAT_MODEL,
        message: '',
        preamble: SYSTEM_PREAMBLE,
        chatHistory: currentHistory as any,
        tools: COPILOT_TOOLS as any,
        toolResults: toolResults as any,
        temperature: 0.4,
      });

      currentHistory = chatRes.chatHistory || currentHistory;
    }

    const finalReply = chatRes.text || 'I have processed your request.';

    // Construct updated conversational history
    const updatedHistory: CopilotChatMessage[] = [
      ...existingHistory,
      { role: 'USER', message: userMessage },
      { role: 'CHATBOT', message: finalReply },
    ];

    return {
      response: finalReply,
      chatHistory: updatedHistory,
      actionsExecuted,
    };
  });
}
