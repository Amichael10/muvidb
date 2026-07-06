import { supabase } from './supabase.js';
import { ADAPTERS, upsertShowtimes, sweepStaleCinemas } from './cinema-adapters/index.js';
import { ytGet, parseDuration, cleanTitle } from './yt_service.js';
import { detectAndNormalizeSeries, normalizeSeriesTitle } from './series_utils.js';
import { mirrorIfExternal } from './image_mirror.js';

/** Try to find a TMDB movie match and return enriched metadata */
async function enrichFromTMDB(title: string, year?: number | null): Promise<{
  synopsis?: string;
  poster_url?: string;
  backdrop_url?: string;
  tmdb_id?: number;
  tmdb_rating?: number;
} | null> {
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!TMDB_KEY) return null;
  try {
    const query = encodeURIComponent(title);
    const yearParam = year ? `&year=${year}` : '';
    const res = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}${yearParam}&with_origin_country=NG`
    );
    if (!res.ok) return null;
    const data = await res.json();
    // Try Nigerian result first, then any result
    let result = data.results?.find((r: any) => r.origin_country?.includes('NG'));
    if (!result) result = data.results?.[0];
    if (!result) return null;
    return {
      synopsis: result.overview?.trim() || undefined,
      poster_url: result.poster_path ? `https://image.tmdb.org/t/p/w500${result.poster_path}` : undefined,
      backdrop_url: result.backdrop_path ? `https://image.tmdb.org/t/p/w780${result.backdrop_path}` : undefined,
      tmdb_id: result.id,
      tmdb_rating: result.vote_average || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Syncs cinema showtimes from various adapters
 */
export async function runShowtimesSync() {
  const { data: cinemas } = await supabase.from('cinemas').select('*').eq('scrape_enabled', true).limit(15);
  if (!cinemas) return { message: 'No cinemas to scrape' };

  const results = [];
  for (const cinema of cinemas) {
    try {
      const adapter = ADAPTERS[cinema.scrape_adapter];
      if (!adapter) continue;
      const scraped = await adapter(cinema);
      const stats = await upsertShowtimes(cinema.id, scraped.showtimes, cinema.scrape_adapter);
      results.push({ name: cinema.name, ...stats });
    } catch (e: any) {
      results.push({ name: cinema.name, error: e.message });
    }
  }

  // After every scrape pass, run the hygiene sweep: expire last month's
  // showtimes and demote titles that no longer appear in any cinema so the
  // "In Cinemas Now" / "Leaving Cinemas Soon" rails stay fresh.
  let sweep: { expired_showtimes: number; dropped_films: number } | { error: string };
  try {
    sweep = await sweepStaleCinemas();
  } catch (e: any) {
    sweep = { error: e.message };
  }

  return { task: 'showtimes', results, sweep };
}

/**
 * Syncs latest videos from YouTube channels and auto-promotes long videos to films
 */
export async function runVideosSync() {
  // Only fetch channels that haven't been fetched in the last 3.5 hours
  const { data: channels } = await supabase
    .from('channels')
    .select('*')
    .or('videos_last_fetched_at.is.null,videos_last_fetched_at.lt.' + new Date(Date.now() - 3.5*3600*1000).toISOString())
    .order('videos_last_fetched_at', { ascending: true, nullsFirst: true });
    
  if (!channels || channels.length === 0) return { message: 'No channels need syncing right now' };

  console.log(`[runVideosSync] Starting sync for ${channels.length} channels`);
  let totalUpserted = 0;
  let channelsProcessed = 0;
  let filmsCreated = 0;
  const FILM_MIN_SEC = 1800; // 30 minutes

  for (const ch of channels) {
    try {
      const handle = ch.channel_handle?.replace(/^@/, '');
      const idMatch = ch.channel_url?.match(/\/channel\/(UC[\w-]+)/);
      let discoveredChannelId = ch.channel_id || idMatch?.[1];
      let uploadsId = '';

      // 1. Fetch Channel Metadata & resolve IDs
      let ytChannelData = null;
      if (discoveredChannelId) {
        ytChannelData = await ytGet('channels', { 
          part: 'snippet,contentDetails,statistics,brandingSettings', 
          id: discoveredChannelId 
        });
      } else if (handle) {
        ytChannelData = await ytGet('channels', { 
          part: 'snippet,contentDetails,statistics,brandingSettings', 
          forHandle: handle 
        });
      }

      if (ytChannelData?.items?.[0]) {
        const item = ytChannelData.items[0];
        discoveredChannelId = item.id;
        uploadsId = item.contentDetails?.relatedPlaylists?.uploads;
        
        // Update Channel Metadata (Logo, Banner, Subs)
        const updateData: any = {
          channel_id: discoveredChannelId,
          subscriber_count: parseInt(item.statistics?.subscriberCount || '0'),
          thumbnail_url: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url,
          banner_url: item.brandingSettings?.image?.bannerExternalUrl || ch.banner_url
        };
        
        if (updateData.banner_url && !updateData.banner_url.includes('=w')) {
            updateData.banner_url = `${updateData.banner_url}=w1060-fcrop64=1,00005a57ffffa5a8-k-c0xffffffff-no-nd-rj`;
        }
        
        if (updateData.thumbnail_url !== ch.thumbnail_url || updateData.banner_url !== ch.banner_url || updateData.subscriber_count !== ch.subscriber_count || updateData.channel_id !== ch.channel_id) {
          await supabase.from('channels').update(updateData).eq('id', ch.id);
        }
      }

      if (!uploadsId) continue;

      // 2. Fetch videos from the uploads playlist. YouTube caps a page at 50,
      // so we paginate up to YT_MAX_PAGES pages (50 videos each). This runs in
      // GitHub Actions now (no Vercel 300s limit), so a deeper backfill is just
      // a matter of raising YT_MAX_PAGES — mind the daily API quota though.
      const maxPages = Math.max(1, parseInt(process.env.YT_MAX_PAGES || '1', 10));
      const plItems: any[] = [];
      let pageToken: string | undefined;
      for (let page = 0; page < maxPages; page++) {
        const plData: any = await ytGet('playlistItems', {
          part: 'snippet',
          playlistId: uploadsId,
          maxResults: '50',
          ...(pageToken ? { pageToken } : {}),
        });
        if (plData.items?.length) plItems.push(...plData.items);
        pageToken = plData.nextPageToken;
        if (!pageToken) break;
      }

      if (!plItems.length) {
        channelsProcessed++;
        continue;
      }

      // videos.list also caps at 50 ids per call — batch the duration/stats lookups.
      const meta: Record<string, any> = {};
      for (let i = 0; i < plItems.length; i += 50) {
        const ids = plItems.slice(i, i + 50).map((it: any) => it.snippet.resourceId.videoId).join(',');
        const vData = await ytGet('videos', { part: 'contentDetails,statistics', id: ids });
        for (const v of vData.items ?? []) {
          meta[v.id] = {
            seconds: parseDuration(v.contentDetails?.duration ?? ''),
            views: parseInt(v.statistics?.viewCount ?? '0'),
          };
        }
      }

      // Fetch hidden videos for this channel
      const { data: hiddenVids } = await supabase
        .from('channel_videos')
        .select('video_id')
        .eq('channel_id', ch.id)
        .eq('is_hidden', true);
      
      const hiddenSet = new Set(hiddenVids?.map((v: any) => v.video_id) || []);

      const videoRows = plItems.map((item: any) => {
        const vid = item.snippet.resourceId.videoId;
        return {
          channel_id: ch.id,
          video_id: vid,
          title: item.snippet.title,
          thumbnail_url: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
          published_at: item.snippet.publishedAt,
          duration_seconds: meta[vid]?.seconds ?? 0
        };
      }).filter((row: any) => !hiddenSet.has(row.video_id));

      if (videoRows.length > 0) {
        await supabase.from('channel_videos').upsert(videoRows, { onConflict: 'channel_id,video_id' });
        totalUpserted += videoRows.length;
      }
      
      // Auto-create films for 30+ min videos from ALL channels (not just
      // owner-linked ones). The 30-min floor keeps out shorts/clips/trailers.
      let newFilms = 0;
      if (videoRows.length > 0) {
        const longVideos = videoRows.filter((v: any) => (v.duration_seconds ?? 0) >= FILM_MIN_SEC);
        
        if (longVideos.length > 0) {
          const vIds = longVideos.map((v: any) => v.video_id);
          const { data: existingCVs } = await supabase
            .from('channel_videos').select('video_id, film_id')
            .eq('channel_id', ch.id).in('video_id', vIds);
            
          const cvMap = new Map();
          if (existingCVs) existingCVs.forEach((cv: any) => cvMap.set(cv.video_id, cv.film_id));

          const videosToProcess = longVideos.filter((v: any) => !cvMap.get(v.video_id));

          if (videosToProcess.length > 0) {
            const processVids = videosToProcess.map((v: any) => v.video_id);
            const { data: existingFilms } = await supabase
              .from('films').select('id, source_video_id').in('source_video_id', processVids);
              
            const existingFilmsMap = new Map();
            if (existingFilms) existingFilms.forEach((f: any) => existingFilmsMap.set(f.source_video_id, f.id));

            const filmsToInsert = [];
            // Track series parent IDs to avoid duplicate lookups
            const seriesParentCache = new Map<string, string>(); // baseTitle → filmId

            for (const v of videosToProcess) {
              if (!existingFilmsMap.has(v.video_id)) {
                const rawTitle = v.title;
                const cleanedTitle = cleanTitle(rawTitle);
                const vidYear = v.published_at ? new Date(v.published_at).getFullYear() : null;

                // ── Detect if this is an episode of a series ──────────────────────────────
                const { isSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(rawTitle);
                const normalizedBase = normalizeSeriesTitle(baseTitle);
                const cleanedBase = cleanTitle(normalizedBase);

                if (isSeries) {
                  // ── Find or create the PARENT series record ────────────────────────────
                  let parentId = seriesParentCache.get(cleanedBase);

                  if (!parentId) {
                    // Look for existing series in DB. Use limit(1) instead of
                    // maybeSingle(): maybeSingle() returns an ERROR (null data)
                    // when duplicates already exist, which made this fall through
                    // and create yet another duplicate parent on every run.
                    const { data: existingList } = await supabase
                      .from('films')
                      .select('id, poster_url')
                      .ilike('title', cleanedBase)
                      .eq('content_type', 'series')
                      .eq('source', 'youtube')
                      .order('created_at', { ascending: true })
                      .limit(1);
                    const existingSeries = existingList?.[0];

                    if (existingSeries) {
                      parentId = existingSeries.id;
                      // Update parent poster with Ep1 thumbnail if parent has none
                      if (!existingSeries.poster_url && v.thumbnail_url) {
                        const mirroredThumb = await mirrorIfExternal(v.thumbnail_url, 'posters', `series-${parentId}`);
                        await supabase.from('films').update({
                          poster_url: mirroredThumb,
                          backdrop_url: mirroredThumb
                        }).eq('id', parentId);
                      }
                    } else {
                      // Create new parent series record
                      const tmdb = await enrichFromTMDB(cleanedBase, vidYear);
                      const posterSrc = tmdb?.poster_url || v.thumbnail_url;
                      const backdropSrc = tmdb?.backdrop_url || v.thumbnail_url;
                      const seriesSlug = cleanedBase.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
                      const mirroredPoster = await mirrorIfExternal(posterSrc, 'posters', `series-new-${seriesSlug}`);
                      const mirroredBackdrop = await mirrorIfExternal(backdropSrc, 'backdrops', `series-new-${seriesSlug}-bd`);
                      const { data: newParent } = await supabase.from('films').insert({
                        title: cleanedBase,
                        year: vidYear,
                        release_type: 'youtube',
                        source: 'youtube',
                        content_type: 'series',
                        youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                        poster_url: mirroredPoster,
                        backdrop_url: mirroredBackdrop,
                        synopsis: tmdb?.synopsis || null,
                        tmdb_id: tmdb?.tmdb_id || null,
                        tmdb_rating: tmdb?.tmdb_rating || null,
                        needs_review: true,
                        status: 'released',
                        language: ch.primary_language || 'English'
                      }).select('id').single();

                      parentId = newParent?.id || null;
                      if (parentId) {
                        console.log(`  🎦 Created series parent: "${cleanedBase}" (${parentId})`);
                        newFilms++;
                      }
                    }
                    if (parentId) seriesParentCache.set(cleanedBase, parentId);
                  }

                  // ── Create the episode record linked to the parent ────────────────────────
                  const epSlug = `ep-${v.video_id}`;
                  const mirroredEpPoster = await mirrorIfExternal(v.thumbnail_url, 'posters', epSlug);
                  filmsToInsert.push({
                    title: cleanedTitle,
                    year: vidYear,
                    release_type: 'youtube',
                    source: 'youtube',
                    source_video_id: v.video_id,
                    youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                    trailer_youtube_id: v.video_id,
                    poster_url: mirroredEpPoster,
                    backdrop_url: mirroredEpPoster,
                    needs_review: true,
                    status: 'released',
                    runtime_minutes: Math.round(v.duration_seconds / 60),
                    language: ch.primary_language || 'English',
                    content_type: 'series',
                    series_id: parentId || null,
                    episode_number: episodeNum,
                    season_number: seasonNum || 1,
                    _videoId: v.video_id // temp key for mapping
                  });

                } else {
                  // ── Regular standalone movie ────────────────────────────────────
                  // Dedup: if a film with this title already exists (same movie
                  // re-uploaded by another aggregator channel, or already in the
                  // catalogue), link this video to it instead of creating a copy.
                  const { data: dupFilm } = await supabase
                    .from('films').select('id')
                    .ilike('title', cleanedTitle)
                    .order('created_at', { ascending: true })
                    .limit(1);
                  if (dupFilm?.[0]) {
                    existingFilmsMap.set(v.video_id, dupFilm[0].id);
                  } else {
                    const tmdb = await enrichFromTMDB(cleanedTitle, vidYear);
                    const rawPoster = tmdb?.poster_url || v.thumbnail_url;
                    const rawBackdrop = tmdb?.backdrop_url || v.thumbnail_url;
                    const movieSlug = `movie-${v.video_id}`;
                    const mirroredMoviePoster = await mirrorIfExternal(rawPoster, 'posters', movieSlug);
                    const mirroredMovieBackdrop = rawBackdrop !== rawPoster
                      ? await mirrorIfExternal(rawBackdrop, 'backdrops', `${movieSlug}-bd`)
                      : mirroredMoviePoster;
                    filmsToInsert.push({
                      title: cleanedTitle,
                      year: vidYear,
                      release_type: 'youtube',
                      source: 'youtube',
                      source_video_id: v.video_id,
                      youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                      trailer_youtube_id: v.video_id,
                      poster_url: mirroredMoviePoster,
                      backdrop_url: mirroredMovieBackdrop,
                      synopsis: tmdb?.synopsis || null,
                      tmdb_id: tmdb?.tmdb_id || null,
                      tmdb_rating: tmdb?.tmdb_rating || null,
                      needs_review: !tmdb?.synopsis,
                      status: 'released',
                      runtime_minutes: Math.round(v.duration_seconds / 60),
                      language: ch.primary_language || 'English',
                      content_type: 'movie',
                    });
                  }
                }
              }
            }

            if (filmsToInsert.length > 0) {
              // Strip the `_videoId` temp mapping key — it is NOT a films column,
              // and leaving it in makes PostgREST reject the whole batch (PGRST204),
              // which silently blocked ALL episode/movie creation. Map by
              // source_video_id after insert instead.
              const cleanFilms = filmsToInsert.map(({ _videoId, ...rest }: any) => rest);
              const { data: newInsertedFilms, error: insertErr } = await supabase
                .from('films').insert(cleanFilms).select();
              if (insertErr) {
                console.error(`[runVideosSync] film insert failed for channel ${ch.name}:`, insertErr.message);
              }
              if (newInsertedFilms) {
                newInsertedFilms.forEach((f: any) => {
                  existingFilmsMap.set(f.source_video_id, f.id);
                  newFilms++;
                });
              }
            }

            const allFilmIds = videosToProcess.map((v: any) => existingFilmsMap.get(v.video_id)).filter(id => id);
            
            if (allFilmIds.length > 0) {
              // Producer credit only for channels linked to a person. Channels
              // without an owner (aggregators/general uploaders) still create
              // films + link channel_videos, they just get no producer credit.
              if (ch.owner_person_id) {
                const { data: existingCredits } = await supabase
                  .from('credits').select('film_id').in('film_id', allFilmIds)
                  .eq('person_id', ch.owner_person_id).eq('role', 'producer');

                const existingCreditSet = new Set(existingCredits?.map((c: any) => c.film_id) || []);
                const creditsToInsert = allFilmIds
                  .filter(id => !existingCreditSet.has(id))
                  .map(id => ({ film_id: id, person_id: ch.owner_person_id, role: 'producer', billing_order: 1 }));

                if (creditsToInsert.length > 0) await supabase.from('credits').insert(creditsToInsert);
              }

              const updatePromises = videosToProcess
                .filter((v: any) => existingFilmsMap.has(v.video_id))
                .map((v: any) => 
                  supabase.from('channel_videos')
                    .update({ film_id: existingFilmsMap.get(v.video_id), match_status: 'auto' })
                    .eq('channel_id', ch.id)
                    .eq('video_id', v.video_id)
                );

              await Promise.all(updatePromises);
            }
          }
        }
      }
      filmsCreated += newFilms;
      await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);
      channelsProcessed++;
    } catch (e: any) {
      console.error(`[runVideosSync] Failed channel ${ch.name}:`, e.message);
    }
  }
  
  return { 
    task: 'videos', status: 'completed', processed: channelsProcessed,
    total_channels: channels.length, upserted: totalUpserted, films_created: filmsCreated
  };
}

/**
 * Syncs trending Nigerian movies from TMDB Discover API
 */
export async function runTMDBSync() {
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!TMDB_KEY) throw new Error('TMDB_API_KEY missing');

  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&sort_by=popularity.desc`;
  const resData = await fetch(url).then(r => r.json());
  const movies = resData.results || [];
  
  if (movies.length === 0) return { task: 'tmdb', imported: 0, message: 'No movies found' };

  let { data: channel } = await supabase.from('channels').select('id').eq('name', 'TMDB Discover').maybeSingle();
  if (!channel) {
    const { data: newChannel, error: chErr } = await supabase.from('channels').insert([{ 
      name: 'TMDB Discover', category: 'Discovery', description: 'Auto-fetched from TMDB Discover API (Nigeria Origin)'
    }]).select().single();
    if (chErr) throw chErr;
    channel = newChannel;
  }

  const { data: hiddenVids } = await supabase.from('channel_videos').select('video_id').eq('channel_id', channel.id).eq('is_hidden', true);
  const hiddenSet = new Set(hiddenVids?.map(v => v.video_id) || []);

  const videoRows = movies.map((m: any) => ({
    channel_id: channel!.id,
    video_id: `TMDB_${m.id}`,
    title: m.title,
    description: m.overview,
    thumbnail_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    published_at: m.release_date ? new Date(m.release_date).toISOString() : new Date().toISOString()
  })).filter(row => !hiddenSet.has(row.video_id));

  if (videoRows.length > 0) {
    await supabase.from('channel_videos').upsert(videoRows, { onConflict: 'channel_id,video_id' });
  }

  await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', channel.id);
  return { task: 'tmdb', imported: movies.length, channel_id: channel.id };
}
