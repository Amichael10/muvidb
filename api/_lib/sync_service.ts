import { supabase } from './supabase.js';
import { ADAPTERS, upsertShowtimes, sweepStaleCinemas } from './cinema-adapters/index.js';
import { ytGet, parseDuration, cleanTitle } from './yt_service.js';
import { detectAndNormalizeSeries, normalizeSeriesTitle } from './series_utils.js';
import { mirrorIfExternal } from './image_mirror.js';
import { enrichFilmsFromAI, attachCreditsBatch, type EnrichedFilm } from './film_enrichment.js';
import { enrichMissingSynopsesConcurrent } from './cohere_enrichment.js';
import { pickTmdbMatch } from './tmdb_match.js';
import {
  curateYouTubeTitle,
  isSensationalizedYouTubeTitle,
  type YouTubeTitleDecision,
} from './youtube_title_policy.js';
import { notifyYouTubeUploads } from './youtube_upload_notify.js';

/** Film-length floor for channel_videos ingest + admin buffer (30 minutes). */
export const CHANNEL_VIDEO_MIN_SEC = 1800;

export function isFilmLengthDuration(seconds: number | null | undefined): boolean {
  return (seconds ?? 0) >= CHANNEL_VIDEO_MIN_SEC;
}

/**
 * True when a freshly fetched video row differs from what is already stored.
 *
 * Sync used to upsert every row on every run. A YouTube video's title,
 * thumbnail, publish date and duration are effectively static, so that rewrote
 * every row and every index on it for no change — by a wide margin the largest
 * write source in the database. Filtering on this trades a cheap read for a
 * costly rewrite.
 *
 * Timestamps are compared as instants, not strings: Postgres returns
 * `2024-01-05T10:30:00+00:00` where the YouTube API sends
 * `2024-01-05T10:30:00Z`. Comparing those as text marks every row as changed
 * and silently defeats the whole filter.
 */
export function channelVideoChanged(
  prior: Record<string, any> | undefined,
  row: Record<string, any>,
  fields: string[],
): boolean {
  if (!prior) return true;

  return fields.some(field => {
    if (field === 'published_at') {
      const a = new Date(prior[field] ?? 0).getTime();
      const b = new Date(row[field] ?? 0).getTime();
      return a !== b;
    }
    return (prior[field] ?? null) !== (row[field] ?? null);
  });
}

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
    // Defensive match: African-origin only, or a tight obscure year+title hit —
    // never fall through to results[0] (a same-named Hollywood film).
    const result = pickTmdbMatch(data.results, { title, year });
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

const YORUBA_KW_REGEX = /(yoruba|iyawo|olori|akoni|alani|oba|orisha|osun|ogboni|apoti|oniduro|asise|eyin oku|ija idile|olugbongaga|iya oko|awimayehun|orun|kadara|mosebolatan|iya gbonkan|baba suwe|baba sala|ijebu|itele|kemity|londoner|ogboluke|kiekie|morili|apankufor|ori|ebo|ifa|egungun|alakada|opomulero|agbada|omoniyi|adebayo|afolayan|ogunde|lolan|ayanfe|gbajumo|gbarada|faaji|oluokun)/i;

function detectVideoLanguage(title: string, channelName: string, primaryLang?: string): string {
  if (primaryLang) return primaryLang;
  const combined = `${title} ${channelName}`;
  if (YORUBA_KW_REGEX.test(combined)) {
    return 'Yoruba';
  }
  return 'English';
}


/**
 * Syncs cinema showtimes from various adapters
 */
export async function runShowtimesSync() {
  // Scrape every enabled cinema (was capped at 15 with no ordering, so ~50 of 65
  // never ran). Ordered by name for deterministic, resumable passes.
  const { data: cinemas } = await supabase.from('cinemas').select('*').eq('scrape_enabled', true).order('name');
  if (!cinemas) return { message: 'No cinemas to scrape' };

  const results = [];
  for (const cinema of cinemas) {
    try {
      const adapter = ADAPTERS[cinema.scrape_adapter];
      if (!adapter) {
        results.push({ name: cinema.name, error: `No adapter configured for '${cinema.scrape_adapter || 'missing'}'` });
        continue;
      }
      const scraped = await adapter(cinema);
      if (scraped.error) throw new Error(scraped.error);
      const stats = await upsertShowtimes(cinema.id, scraped.showtimes, cinema.scrape_adapter);
      results.push({
        name: cinema.name,
        raw_showtimes: scraped.showtimes.length,
        warnings: scraped.warnings || [],
        ...stats,
      });
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
  // Only fetch channels that (a) are enabled for sync and (b) haven't been
  // fetched in the last 3.5 hours. Admins can pause a channel via the
  // sync_enabled toggle to keep the daily sync from pulling its videos.
  //
  // Paginated in 1000-row pages so this never depends on the PostgREST max-rows
  // cap. That lets max-rows be lowered (anti-scraping) without truncating the
  // channel list — previously this relied on max-rows=5000 to see all channels.
  const staleCutoff = new Date(Date.now() - 3.5 * 3600 * 1000).toISOString();
  const channels: any[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('sync_enabled', true)
      .or('videos_last_fetched_at.is.null,videos_last_fetched_at.lt.' + staleCutoff)
      .order('videos_last_fetched_at', { ascending: true, nullsFirst: true })
      .range(from, from + PAGE - 1);
    if (error || !data?.length) break;
    channels.push(...data);
    if (data.length < PAGE) break;
  }

  if (channels.length === 0) return { message: 'No channels need syncing right now' };

  console.log(`[runVideosSync] Starting sync for ${channels.length} channels`);
  let totalUpserted = 0;
  let channelsProcessed = 0;
  let filmsCreated = 0;
  let sensationalTitlesSkipped = 0;
  let embeddedTitlesCleaned = 0;
  let shortSkipped = 0;

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

        // Claimed professionals keep a compact snapshot on people so their
        // dashboard and CV can load channel analytics without another API call.
        if (ch.owner_person_id) {
          const { data: owner } = await supabase.from('people').select('youtube_stats').eq('id', ch.owner_person_id).single();
          await supabase.from('people').update({
            youtube_channel_id: discoveredChannelId,
            youtube_handle: item.snippet?.customUrl || null,
            youtube_stats: {
              ...(owner?.youtube_stats || {}),
              title: item.snippet?.title || ch.name,
              subscribers: item.statistics?.subscriberCount || '0',
              views: item.statistics?.viewCount || '0',
              videos: item.statistics?.videoCount || '0',
              thumbnail: updateData.thumbnail_url,
              banner: updateData.banner_url,
              last_updated: new Date().toISOString(),
            },
          }).eq('id', ch.owner_person_id);
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
      // One read serves two purposes: which videos are hidden, and what we
      // already have stored so unchanged rows can be skipped below.
      const { data: storedVids } = await supabase
        .from('channel_videos')
        .select('video_id,is_hidden,title,thumbnail_url,published_at,duration_seconds')
        .eq('channel_id', ch.id);

      const hiddenSet = new Set(
        (storedVids || []).filter((v: any) => v.is_hidden).map((v: any) => v.video_id),
      );
      const storedByVideo = new Map((storedVids || []).map((v: any) => [v.video_id, v]));

      const videoRows = plItems.map((item: any) => {
        const vid = item.snippet.resourceId.videoId;
        return {
          channel_id: ch.id,
          video_id: vid,
          title: item.snippet.title,
          // Kept out of the channel_videos insert below (not a column); used
          // only to feed AI enrichment (synopsis cleaning) at film-creation.
          _description: item.snippet.description ?? '',
          thumbnail_url: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url ?? null,
          published_at: item.snippet.publishedAt,
          duration_seconds: meta[vid]?.seconds ?? 0
        };
      }).filter((row: any) => !hiddenSet.has(row.video_id));

      // Buffer is film-length only — trailers/skits never enter channel_videos.
      const shortInBatch = videoRows.filter((row: any) => !isFilmLengthDuration(row.duration_seconds));
      shortSkipped += shortInBatch.length;
      const filmLengthRows = videoRows.filter((row: any) => isFilmLengthDuration(row.duration_seconds));

      // Telegram alert for brand-new film-length uploads (before auto-import).
      const brandNewUploads = filmLengthRows.filter((row: any) => !storedByVideo.has(row.video_id));
      if (brandNewUploads.length > 0) {
        try {
          const alertRes = await notifyYouTubeUploads(ch, brandNewUploads);
          if (alertRes.notified > 0) {
            console.log(`[runVideosSync] Telegram alerted ${alertRes.notified} new upload(s) for ${ch.name}`);
          }
        } catch (e: any) {
          console.warn(`[runVideosSync] youtube upload notify failed for ${ch.name}:`, e?.message || e);
        }
      }

      if (filmLengthRows.length > 0) {
        // Strip the _description helper — it's not a channel_videos column and
        // would fail the whole upsert (PGRST204). It stays on the in-memory rows
        // for AI enrichment below.
        const cleanVideoRows = filmLengthRows.map(({ _description, ...rest }: any) => rest);

        // Only write rows that are new or genuinely different. A YouTube
        // video's title, thumbnail, publish date and duration are effectively
        // static, so upserting all of them every run rewrote every row and
        // every index on it for no change — this was by far the largest write
        // source in the database. Reads are cheap; row rewrites are not.
        const changedRows = cleanVideoRows.filter((row: any) =>
          channelVideoChanged(storedByVideo.get(row.video_id), row, [
            'title',
            'thumbnail_url',
            'duration_seconds',
            'published_at',
          ]),
        );

        if (changedRows.length > 0) {
          await supabase.from('channel_videos').upsert(changedRows, { onConflict: 'channel_id,video_id' });
        }
        // Counts actual writes now, not rows considered.
        totalUpserted += changedRows.length;
      }
      
      // Auto-create films for 30+ min videos from ALL channels (not just
      // owner-linked ones). The 30-min floor keeps out shorts/clips/trailers.
      let newFilms = 0;
      if (filmLengthRows.length > 0) {
        const longVideos = filmLengthRows;
        
        if (longVideos.length > 0) {
          const vIds = longVideos.map((v: any) => v.video_id);
          const { data: existingCVs } = await supabase
            .from('channel_videos').select('video_id, film_id')
            .eq('channel_id', ch.id).in('video_id', vIds);
            
          const cvMap = new Map();
          if (existingCVs) existingCVs.forEach((cv: any) => cvMap.set(cv.video_id, cv.film_id));

          const videosToProcess = longVideos.filter((v: any) => !cvMap.get(v.video_id));
          const titlePolicies = new Map<string, YouTubeTitleDecision>(
            videosToProcess.map((v: any) => [v.video_id, curateYouTubeTitle(v.title)]),
          );
          const skippedVideos = videosToProcess.filter(
            (v: any) => titlePolicies.get(v.video_id)?.action === 'skip',
          );
          const eligibleVideos = videosToProcess.filter(
            (v: any) => titlePolicies.get(v.video_id)?.action !== 'skip',
          );

          if (skippedVideos.length > 0) {
            sensationalTitlesSkipped += skippedVideos.length;
            const skippedIds = skippedVideos.map((v: any) => v.video_id);
            await supabase
              .from('channel_videos')
              .update({ is_hidden: true, match_status: 'rejected' })
              .eq('channel_id', ch.id)
              .in('video_id', skippedIds);
            console.log(`  Skipped ${skippedVideos.length} sensational title(s) without a film-title prefix`);
          }

          // AI enrichment (title cleanup + cast extraction + synopsis de-spam)
          // for this batch. Best-effort: an empty map means the AI was
          // unavailable and we fall back to the regex cleaner / TMDB below.
          let aiMap = new Map<string, EnrichedFilm>();
          if (eligibleVideos.length > 0) {
            try {
              aiMap = await enrichFilmsFromAI(
                eligibleVideos.map((v: any) => ({ videoId: v.video_id, title: v.title, description: v._description })),
              );
            } catch (e: any) {
              console.warn(`[runVideosSync] AI enrichment skipped for ${ch.name}: ${e.message}`);
            }
          }

          if (eligibleVideos.length > 0) {
            const processVids = eligibleVideos.map((v: any) => v.video_id);
            const { data: existingFilms } = await supabase
              .from('films').select('id, source_video_id').in('source_video_id', processVids);
              
            const existingFilmsMap = new Map();
            if (existingFilms) existingFilms.forEach((f: any) => existingFilmsMap.set(f.source_video_id, f.id));

            const filmsToInsert = [];
            // Track series parent IDs to avoid duplicate lookups
            const seriesParentCache = new Map<string, string>(); // baseTitle → filmId

            for (const v of eligibleVideos) {
              if (!existingFilmsMap.has(v.video_id)) {
                const rawTitle = v.title;
                const ai = aiMap.get(v.video_id);
                const titlePolicy = titlePolicies.get(v.video_id)!;
                if (!titlePolicy || titlePolicy.action === 'skip' || !titlePolicy.title) continue;
                const aiTitle = ai?.title?.trim();
                const normalizedRaw = rawTitle.toLocaleLowerCase();
                const usableAiTitle = Boolean(
                  aiTitle
                  && aiTitle.length <= 70
                  && normalizedRaw.includes(aiTitle.toLocaleLowerCase())
                  && !isSensationalizedYouTubeTitle(aiTitle),
                );
                // The policy supplies a safe deterministic prefix. AI may
                // shorten that prefix further when cast names were placed
                // before the marketing marker, but only to text present in the
                // original upload title.
                const cleanedTitle = usableAiTitle ? cleanTitle(aiTitle!) : titlePolicy.title;
                if (titlePolicy.action === 'clean') embeddedTitlesCleaned++;
                const vidYear = v.published_at ? new Date(v.published_at).getFullYear() : null;
                // Keep the full upload date, not just the year. publishedAt is the
                // only date YouTube gives us, and for YouTube-native films it IS
                // the release date. (Re-uploads of older cinema films will read as
                // their upload date — TMDB is the fix for those, not this.)
                const vidDate = v.published_at ? new Date(v.published_at).toISOString().slice(0, 10) : null;

                // ── Detect if this is an episode of a series ──────────────────────────────
                const { isSeries, baseTitle, episodeNum, seasonNum } = detectAndNormalizeSeries(cleanedTitle);
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
                        original_title: titlePolicy.originalTitle,
                        year: vidYear,
                        release_date: vidDate,
                        release_type: 'youtube',
                        source: 'youtube',
                        content_type: 'series',
                        youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                        poster_url: mirroredPoster,
                        backdrop_url: mirroredBackdrop,
                        synopsis: ai?.synopsis || tmdb?.synopsis || null,
                        tmdb_id: tmdb?.tmdb_id || null,
                        tmdb_rating: tmdb?.tmdb_rating || null,
                        needs_review: true,
                        status: 'released',
                        language: detectVideoLanguage(cleanedBase, ch.name, ch.primary_language)
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
                    original_title: titlePolicy.originalTitle,
                    year: vidYear,
                    release_date: vidDate,
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
                    language: detectVideoLanguage(cleanedTitle, ch.name, ch.primary_language),
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
                      original_title: titlePolicy.originalTitle,
                      year: vidYear,
                      release_date: vidDate,
                      release_type: 'youtube',
                      source: 'youtube',
                      source_video_id: v.video_id,
                      youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                      trailer_youtube_id: v.video_id,
                      poster_url: mirroredMoviePoster,
                      backdrop_url: mirroredMovieBackdrop,
                      synopsis: ai?.synopsis || tmdb?.synopsis || null,
                      tmdb_id: tmdb?.tmdb_id || null,
                      tmdb_rating: tmdb?.tmdb_rating || null,
                      needs_review: !(ai?.synopsis || tmdb?.synopsis),
                      status: 'released',
                      runtime_minutes: Math.round(v.duration_seconds / 60),
                      language: detectVideoLanguage(cleanedTitle, ch.name, ch.primary_language),
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
                const newlyAddedIds = newInsertedFilms.map((f: any) => f.id);
                if (newlyAddedIds.length > 0) {
                  try {
                    const synCount = await enrichMissingSynopsesConcurrent(newlyAddedIds);
                    console.log(`[runVideosSync] Cohere generated synopses for ${synCount}/${newlyAddedIds.length} newly imported films`);
                  } catch (e: any) {
                    console.warn(`[runVideosSync] Cohere synopsis enrichment error:`, e.message);
                  }
                }
              }
            }

            const allFilmIds = eligibleVideos.map((v: any) => existingFilmsMap.get(v.video_id)).filter(id => id);
            
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

              const updatePromises = eligibleVideos
                .filter((v: any) => existingFilmsMap.has(v.video_id))
                .map((v: any) => 
                  supabase.from('channel_videos')
                    .update({ film_id: existingFilmsMap.get(v.video_id), match_status: 'auto' })
                    .eq('channel_id', ch.id)
                    .eq('video_id', v.video_id)
                );

              await Promise.all(updatePromises);

              // Attach AI-extracted cast + director to each film (creates the
              // people if needed). Best-effort — a failure never blocks the sync.
              const creditEntries = eligibleVideos
                .map((v: any) => {
                  const ai = aiMap.get(v.video_id);
                  const people = [
                    ...(ai?.cast || []).map((name: string) => ({ name, role: 'actor' })),
                    ...(ai?.director ? [{ name: ai.director, role: 'director' }] : []),
                  ];
                  return { filmId: existingFilmsMap.get(v.video_id), people };
                })
                .filter((e: any) => e.filmId && e.people.length);
              if (creditEntries.length) {
                try {
                  const added = await attachCreditsBatch(creditEntries);
                  if (added) console.log(`  🎭 Linked ${added} cast/crew credits from AI enrichment`);
                } catch (e: any) {
                  console.warn(`[runVideosSync] credit attach failed: ${e.message}`);
                }
              }
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
    total_channels: channels.length, upserted: totalUpserted, films_created: filmsCreated,
    sensational_titles_skipped: sensationalTitlesSkipped,
    embedded_titles_cleaned: embeddedTitlesCleaned,
    short_skipped: shortSkipped,
  };
}

/**
 * Delete unmapped buffer rows older than `maxAgeDays` so the triage queue
 * cannot grow forever. Linked videos (film_id set) are never touched.
 */
export async function purgeStaleUnmappedChannelVideos(opts: { maxAgeDays?: number } = {}) {
  const maxAgeDays = Math.max(1, opts.maxAgeDays ?? 30);
  const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
  const BATCH = 500;
  let deleted = 0;

  for (;;) {
    const { data, error } = await supabase
      .from('channel_videos')
      .select('id')
      .is('film_id', null)
      .lt('created_at', cutoff)
      .limit(BATCH);
    if (error) throw error;
    if (!data?.length) break;

    const ids = data.map((r) => r.id);
    const { error: dErr } = await supabase.from('channel_videos').delete().in('id', ids);
    if (dErr) throw dErr;
    deleted += ids.length;
  }

  return {
    task: 'purge_stale_buffer',
    status: 'completed',
    max_age_days: maxAgeDays,
    cutoff,
    deleted,
  };
}

/**
 * Syncs new & trending Nigerian movies from TMDB Discover API across
 * current year releases, streaming, and popularity.
 */
export async function runTMDBSync() {
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  if (!TMDB_KEY) throw new Error('TMDB_API_KEY missing');

  const currentYear = new Date().getFullYear();
  const discoveryUrls = [
    // 1. Current year new releases sorted by release date (Pages 1-2)
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&primary_release_year=${currentYear}&sort_by=primary_release_date.desc&page=1`,
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&primary_release_year=${currentYear}&sort_by=primary_release_date.desc&page=2`,
    // 2. Previous year releases
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&primary_release_year=${currentYear - 1}&sort_by=popularity.desc&page=1`,
    // 3. Trending by all-time popularity
    `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&sort_by=popularity.desc&page=1`,
  ];

  const movieMap = new Map<number, any>();
  for (const url of discoveryUrls) {
    try {
      const resData = await fetch(url).then((r) => r.json());
      for (const m of resData.results || []) {
        if (m?.id && !movieMap.has(m.id)) {
          movieMap.set(m.id, m);
        }
      }
    } catch (e: any) {
      console.warn(`[runTMDBSync] discovery URL failed: ${e.message}`);
    }
  }

  const movies = Array.from(movieMap.values());
  if (movies.length === 0) return { task: 'tmdb', imported: 0, message: 'No movies found' };

  let filmsCreated = 0;
  let filmsEnriched = 0;

  for (const m of movies) {
    try {
      const tmdbIdStr = String(m.id);
      const title = m.title?.trim();
      if (!title) continue;

      const year = m.release_date ? parseInt(m.release_date.slice(0, 4), 10) : currentYear;

      // Check if film already exists in films table by tmdb_id or title
      const { data: byTmdb } = await supabase
        .from('films')
        .select('id, tmdb_id, poster_url, backdrop_url, synopsis')
        .eq('tmdb_id', tmdbIdStr)
        .maybeSingle();

      let existing = byTmdb;
      if (!existing) {
        const { data: byTitle } = await supabase
          .from('films')
          .select('id, tmdb_id, poster_url, backdrop_url, synopsis')
          .ilike('title', title)
          .maybeSingle();
        existing = byTitle;
      }

      if (existing) {
        // Enrich existing film if TMDB ID or posters are missing
        const updates: any = {};
        if (!existing.tmdb_id) updates.tmdb_id = tmdbIdStr;
        if (!existing.poster_url && m.poster_path) updates.poster_url = `https://image.tmdb.org/t/p/original${m.poster_path}`;
        if (!existing.backdrop_url && m.backdrop_path) updates.backdrop_url = `https://image.tmdb.org/t/p/original${m.backdrop_path}`;
        if (!existing.synopsis && m.overview) updates.synopsis = m.overview;

        if (Object.keys(updates).length > 0) {
          await supabase.from('films').update(updates).eq('id', existing.id);
          filmsEnriched++;
        }
        continue;
      }

      // Fetch full details with credits
      let detail: any = m;
      try {
        const detailRes = await fetch(
          `https://api.themoviedb.org/3/movie/${m.id}?api_key=${TMDB_KEY}&append_to_response=credits,watch/providers`
        );
        if (detailRes.ok) detail = await detailRes.json();
      } catch (e) {}

      const slugBase = `${title}-${year}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const posterUrl = detail.poster_path ? `https://image.tmdb.org/t/p/original${detail.poster_path}` : null;
      const backdropUrl = detail.backdrop_path ? `https://image.tmdb.org/t/p/original${detail.backdrop_path}` : posterUrl;
      const genres = (detail.genres || []).map((g: any) => g.name).filter(Boolean);

      let finalSlug = slugBase;
      const { data: slugCheck } = await supabase.from('films').select('id').eq('slug', finalSlug).maybeSingle();
      if (slugCheck) {
        finalSlug = `${slugBase}-${m.id}`;
      }

      const { data: newFilm, error: insErr } = await supabase
        .from('films')
        .insert({
          title,
          slug: finalSlug,
          year,
          release_date: detail.release_date || null,
          synopsis: detail.overview || null,
          poster_url: posterUrl,
          backdrop_url: backdropUrl,
          runtime_minutes: detail.runtime || null,
          tmdb_id: tmdbIdStr,
          tmdb_rating: detail.vote_average || null,
          tmdb_vote_count: detail.vote_count || null,
          genres: genres.length ? genres : ['Drama'],
          countries: ['Nigeria'],
          status: 'released',
          is_nollywood: true,
          is_published: true,
          content_type: 'movie',
        })
        .select('id')
        .single();

      if (insErr) {
        console.warn(`[runTMDBSync] insert film failed for "${title}":`, insErr.message);
        continue;
      }

      filmsCreated++;

      // Link top cast and director credits
      const cast = detail.credits?.cast?.slice(0, 8) || [];
      const directors = (detail.credits?.crew || []).filter((c: any) => c.job === 'Director' || c.department === 'Directing').slice(0, 2);

      const creditsToInsert = [
        ...cast.map((c: any, idx: number) => ({ name: c.name, role: 'actor', char: c.character || null, order: idx + 1, dept: 'Acting' })),
        ...directors.map((c: any, idx: number) => ({ name: c.name, role: 'director', char: null, order: idx + 1, dept: 'Directing' })),
      ];

      for (const p of creditsToInsert) {
        if (!p.name?.trim()) continue;
        let { data: personRow } = await supabase.from('people').select('id').ilike('name', p.name.trim()).maybeSingle();
        let personId = personRow?.id;
        if (!personId) {
          const pSlug = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          const { data: createdPerson } = await supabase
            .from('people')
            .insert({ name: p.name.trim(), slug: pSlug, known_for_department: p.dept })
            .select('id')
            .maybeSingle();
          personId = createdPerson?.id;
        }

        if (personId && newFilm?.id) {
          await supabase.from('credits').insert({
            film_id: newFilm.id,
            person_id: personId,
            role: p.role,
            character_name: p.char,
            billing_order: p.order,
            source: 'tmdb',
          });
        }
      }
    } catch (e: any) {
      console.warn(`[runTMDBSync] Failed processing movie ${m.title}:`, e.message);
    }
  }

  return {
    task: 'tmdb',
    discovered: movies.length,
    films_created: filmsCreated,
    films_enriched: filmsEnriched,
  };
}
