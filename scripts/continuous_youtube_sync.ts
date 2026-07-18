import { ytGet, parseDuration, cleanTitle } from '../api/_lib/yt_service.js';
import { pickTmdbMatch } from '../api/_lib/tmdb_match.js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase API keys in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${query}${yearParam}&with_origin_country=NG`,
      { signal: AbortSignal.timeout(30000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
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

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🚀 Starting Continuous Deep YouTube Sync...');

  const FILM_MIN_SEC = 1800; // 30 minutes

  while (true) {
    console.log('\n--- Fetching all channels ---');
    const { data: channels, error } = await supabase
      .from('channels')
      .select('*')
      .order('id', { ascending: true });

    if (error) {
      console.error('❌ Error fetching channels:', error.message);
      await delay(60000);
      continue;
    }

    if (!channels || channels.length === 0) {
      console.log('ℹ️ No channels found. Sleeping for 1 hour.');
      await delay(3600000);
      continue;
    }

    console.log(`Found ${channels.length} channels. Processing...`);

    for (const ch of channels) {
      console.log(`\n📺 Processing channel: ${ch.name}`);
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
        }

        if (!uploadsId) {
          console.log(`⚠️ Could not find uploads playlist for ${ch.name}. Skipping.`);
          continue;
        }

        let nextPageToken: string | undefined = undefined;
        let foundExisting = false;
        let pagesFetched = 0;
        let newFilmsCreated = 0;
        let newVideosAdded = 0;

        // 2. Fetch Latest Videos with pagination
        do {
          const params: Record<string, string> = {
            part: 'snippet', 
            playlistId: uploadsId, 
            maxResults: '50'
          };
          if (nextPageToken) params.pageToken = nextPageToken;

          const plData = await ytGet('playlistItems', params);
          
          if (!plData.items?.length) break;

          const videoIds = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
          const vData = await ytGet('videos', { part: 'contentDetails,statistics', id: videoIds });

          const meta: Record<string, any> = {};
          for (const v of vData.items ?? []) {
            meta[v.id] = { 
              seconds: parseDuration(v.contentDetails?.duration ?? ''), 
              views: parseInt(v.statistics?.viewCount ?? '0') 
            };
          }

          // Fetch hidden videos
          const { data: hiddenVids } = await supabase
            .from('channel_videos')
            .select('video_id')
            .eq('channel_id', ch.id)
            .eq('is_hidden', true);
          const hiddenSet = new Set(hiddenVids?.map((v: any) => v.video_id) || []);

          const videoRows = plData.items.map((item: any) => {
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

          // Check if any of these videos already exist in our DB
          if (videoRows.length > 0) {
            const vIds = videoRows.map((v: any) => v.video_id);
            const { data: existingVids } = await supabase
              .from('channel_videos')
              .select('video_id')
              .eq('channel_id', ch.id)
              .in('video_id', vIds);
              
            const existingSet = new Set(existingVids?.map((v: any) => v.video_id) || []);
            
            // If ALL of the videos on this page already exist, we can stop paginating for this channel
            if (existingVids && existingVids.length === videoRows.length) {
              console.log(`✅ All videos on page ${pagesFetched + 1} already exist. Moving to next channel.`);
              foundExisting = true;
              break;
            }

            const newVideos = videoRows.filter((v: any) => !existingSet.has(v.video_id));

            if (newVideos.length > 0) {
              await supabase.from('channel_videos').upsert(newVideos, { onConflict: 'channel_id,video_id' });
              newVideosAdded += newVideos.length;

              // Auto-create films for 30+ min videos
              if (ch.owner_person_id) {
                const longVideos = newVideos.filter((v: any) => (v.duration_seconds ?? 0) >= FILM_MIN_SEC);
                
                if (longVideos.length > 0) {
                  const filmsToInsert = [];
                  const existingFilmsMap = new Map();

                  for (const v of longVideos) {
                    const cleanedTitle = cleanTitle(v.title);
                    const vidYear = v.published_at ? new Date(v.published_at).getFullYear() : null;
                    const tmdb = await enrichFromTMDB(cleanedTitle, vidYear);
                    filmsToInsert.push({
                      title: cleanedTitle, 
                      year: vidYear,
                      release_type: 'youtube', 
                      source: 'youtube', 
                      source_video_id: v.video_id,
                      youtube_watch_url: `https://www.youtube.com/watch?v=${v.video_id}`,
                      trailer_youtube_id: v.video_id, 
                      poster_url: tmdb?.poster_url || v.thumbnail_url,
                      backdrop_url: tmdb?.backdrop_url || v.thumbnail_url,
                      synopsis: tmdb?.synopsis || null,
                      tmdb_id: tmdb?.tmdb_id || null,
                      tmdb_rating: tmdb?.tmdb_rating || null,
                      needs_review: !tmdb?.synopsis, 
                      status: 'released',
                      runtime_minutes: Math.round(v.duration_seconds / 60),
                      language: ch.primary_language || 'English'
                    });
                  }

                  if (filmsToInsert.length > 0) {
                    const { data: newInsertedFilms } = await supabase.from('films').insert(filmsToInsert).select();
                    if (newInsertedFilms) {
                      newInsertedFilms.forEach((f: any) => {
                        existingFilmsMap.set(f.source_video_id, f.id);
                        newFilmsCreated++;
                      });
                    }
                  }

                  // Add credits and update channel_videos
                  const allFilmIds = longVideos.map((v: any) => existingFilmsMap.get(v.video_id)).filter((id: any) => id);
                  if (allFilmIds.length > 0) {
                    const creditsToInsert = allFilmIds.map((id: any) => ({ 
                      film_id: id, person_id: ch.owner_person_id, role: 'producer', billing_order: 1 
                    }));
                    if (creditsToInsert.length > 0) await supabase.from('credits').insert(creditsToInsert);

                    const updatePromises = longVideos
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
          }

          nextPageToken = plData.nextPageToken;
          pagesFetched++;
          
          if (!foundExisting && nextPageToken) {
            console.log(`... fetched page ${pagesFetched}, moving to next page ...`);
            await delay(1000); // polite sleep
          }

        } while (nextPageToken && !foundExisting);

        console.log(`✅ Channel ${ch.name} sync complete. Pages: ${pagesFetched}, New Videos: ${newVideosAdded}, New Films: ${newFilmsCreated}`);
        await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);

      } catch (e: any) {
        console.error(`❌ Failed processing channel ${ch.name}:`, e.message);
      }

      await delay(5000); // 5 sec delay between channels to avoid rate limit spikes
    }

    console.log('\n✅ Completed full pass over all channels.');
    console.log('💤 Sleeping for 6 hours before next full pass...');
    await delay(6 * 60 * 60 * 1000);
  }
}

main().catch(err => {
  console.error("Critical error in continuous YouTube sync:", err);
  process.exit(1);
});
