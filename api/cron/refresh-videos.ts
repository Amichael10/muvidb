import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { isValidAuth } from '../_lib/auth';

export const config = {
  maxDuration: 60, // 60 seconds
};

const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytGet(endpoint: string, params: Record<string, string>) {
  if (!YT_KEY) throw new Error('YOUTUBE_API_KEY is missing in environment');
  
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  
  console.log(`[YouTube API] Fetching: ${endpoint} with params:`, { ...params, key: '***' });
  
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorBody = await res.text();
    let detail = errorBody;
    try {
      const json = JSON.parse(errorBody);
      detail = json.error?.message || errorBody;
    } catch (e) {}
    throw new Error(`YouTube /${endpoint} ${res.status}: ${detail}`);
  }
  return res.json();
}

function parseDuration(iso: string): number {
  const h = parseInt(iso.match(/(\d+)H/)?.[1] ?? '0');
  const m = parseInt(iso.match(/(\d+)M/)?.[1] ?? '0');
  const s = parseInt(iso.match(/(\d+)S/)?.[1] ?? '0');
  return h * 3600 + m * 60 + s;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  
  console.log(`[refresh-videos] Triggered. Method: ${req.method}, Query:`, req.query);

  // Basic auth check
  try {
    const authOk = await isValidAuth(req);
    if (!authOk) {
      console.warn('[refresh-videos] Auth check failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch (authErr: any) {
    console.error('[refresh-videos] Auth exception:', authErr.message);
    return res.status(401).json({ error: `Auth Error: ${authErr.message}` });
  }

  const { channelId } = req.query;

  try {
    let channelsToProcess = [];
    if (channelId) {
      const { data: channel, error: chFetchErr } = await supabase.from('channels').select('*').eq('id', channelId).single();
      if (chFetchErr || !channel) {
        console.error(`[refresh-videos] Channel ${channelId} not found in DB:`, chFetchErr?.message);
        return res.status(404).json({ error: 'Channel not found' });
      }
      channelsToProcess = [channel];
    } else {
      const { data: channels, error: listErr } = await supabase.from('channels').select('*');
      if (listErr) throw new Error(`Failed to list channels: ${listErr.message}`);
      channelsToProcess = channels || [];
    }

    console.log(`[refresh-videos] Processing ${channelsToProcess.length} channels`);

    let totalVideosUpserted = 0;
    const processResults = [];

    for (const ch of channelsToProcess) {
      try {
        const handle = ch.channel_handle?.replace(/^@/, '');
        let uploadsId = '';
        let discoveredChannelId = ch.channel_id;

        // 1. Resolve uploads playlist ID & fetch subscriber count
        if (discoveredChannelId) {
           const d = await ytGet('channels', { part: 'contentDetails,statistics', id: discoveredChannelId });
           if (d.items?.[0]) {
             uploadsId = d.items[0].contentDetails?.relatedPlaylists?.uploads;
             const subCount = parseInt(d.items[0].statistics?.subscriberCount || '0');
             if (subCount > 0) {
               await supabase.from('channels').update({ subscriber_count: subCount }).eq('id', ch.id);
             }
           }
        } else if (handle) {
           const d = await ytGet('channels', { part: 'contentDetails,statistics', forHandle: handle });
           if (d.items?.[0]) {
             discoveredChannelId = d.items[0].id;
             uploadsId = d.items[0].contentDetails?.relatedPlaylists?.uploads;
             const subCount = parseInt(d.items[0].statistics?.subscriberCount || '0');
             
             // Backfill the real YouTube channel ID & subscriber count
             await supabase.from('channels').update({ 
               channel_id: discoveredChannelId,
               subscriber_count: subCount 
             }).eq('id', ch.id);
           }
        }

        if (!uploadsId) {
          console.warn(`[refresh-videos] Skip: No uploads playlist for ${ch.name}`);
          processResults.push({ name: ch.name, status: 'skipped', reason: 'No uploads playlist' });
          continue;
        }

        // 2. Fetch latest videos incrementally
        const { data: latestVid } = await supabase
          .from('channel_videos')
          .select('published_at')
          .eq('channel_id', ch.id)
          .order('published_at', { ascending: false })
          .limit(1)
          .single();
        
        const latestDate = latestVid ? new Date(latestVid.published_at) : new Date(0);
        let nextPageToken = '';
        let fetchedCount = 0;
        let stopFetching = false;
        const allVideoRows = [];

        // Helper to clean YouTube titles
        const cleanTitle = (t: string) => {
          return t
            .replace(/\|?\s*Nigerian Movie\s*\|?/gi, '')
            .replace(/\|?\s*Full Movie\s*\|?/gi, '')
            .replace(/\|?\s*Nollywood\s*\|?/gi, '')
            .replace(/\|?\s*\d{4}\s*\|?/g, '')
            .replace(/【.*?】/g, '')
            .replace(/\[.*?\]/g, '')
            .trim();
        };

        while (!stopFetching && fetchedCount < 200) {
          const plData = await ytGet('playlistItems', { 
            part: 'snippet', 
            playlistId: uploadsId, 
            maxResults: '50',
            pageToken: nextPageToken
          });

          if (!plData.items?.length) break;

          const pageItems = plData.items;
          const videoIds = pageItems.map((i: any) => i.snippet.resourceId.videoId).join(',');
          const vData = await ytGet('videos', { part: 'contentDetails,snippet', id: videoIds });

          for (const v of vData.items) {
            const duration = parseDuration(v.contentDetails.duration);
            const isPromotable = duration >= 900; // 15 mins
            let filmId = null;
            let matchStatus = 'unmatched';

            if (isPromotable) {
              // 1. Check if film exists
              const { data: existingFilm } = await supabase
                .from('films')
                .select('id')
                .eq('source_video_id', v.id)
                .maybeSingle();

              if (existingFilm) {
                filmId = existingFilm.id;
                matchStatus = 'matched';
              } else {
                // 2. Create Film
                const { data: newFilm, error: filmErr } = await supabase
                  .from('films')
                  .insert([{
                    title: cleanTitle(v.snippet.title),
                    synopsis: v.snippet.description || '',
                    poster_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
                    release_type: 'youtube',
                    youtube_watch_url: `https://www.youtube.com/watch?v=${v.id}`,
                    source_video_id: v.id,
                    year: new Date(v.snippet.publishedAt).getFullYear(),
                    runtime_minutes: Math.round(duration / 60)
                  }])
                  .select()
                  .single();

                if (!filmErr && newFilm) {
                  filmId = newFilm.id;
                  matchStatus = 'matched';
                  console.log(`[refresh-videos] Auto-Promoted: ${newFilm.title}`);

                  // 3. Auto-Credit Channel Owner
                  if (ch.owner_person_id) {
                    await supabase.from('credits').insert([{
                      film_id: filmId,
                      person_id: ch.owner_person_id,
                      role: 'Actor', // Default to Actor for now
                      billing_order: 1
                    }]);
                    console.log(`[refresh-videos] Auto-Credited Owner for: ${newFilm.title}`);
                  }
                } else if (filmErr) {
                  console.error(`[refresh-videos] Failed auto-promote ${v.id}:`, filmErr.message);
                }
              }
            }

            allVideoRows.push({
              channel_id: ch.id,
              video_id: v.id,
              title: v.snippet.title,
              thumbnail_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
              published_at: v.snippet.publishedAt,
              duration_seconds: duration,
              match_status: matchStatus,
              film_id: filmId
            });
          }

          fetchedCount += vData.items.length;
          const oldestInPage = new Date(vData.items[vData.items.length - 1].snippet.publishedAt);
          if (oldestInPage <= latestDate) stopFetching = true;

          nextPageToken = plData.nextPageToken;
          if (!nextPageToken) stopFetching = true;
        }

        if (allVideoRows.length === 0) {
          processResults.push({ name: ch.name, status: 'skipped', reason: 'No new videos found' });
          continue;
        }

        const { error: upsertErr } = await supabase.from('channel_videos').upsert(allVideoRows, { 
          onConflict: 'channel_id,video_id' 
        });

        if (upsertErr) {
          console.error(`[refresh-videos] Upsert error for ${ch.name}:`, upsertErr.message);
          processResults.push({ name: ch.name, status: 'error', reason: upsertErr.message });
        } else {
          totalVideosUpserted += allVideoRows.length;
          await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);
          processResults.push({ name: ch.name, status: 'success', count: allVideoRows.length });
        }
      } catch (err: any) {
        console.error(`[refresh-videos] Error processing channel ${ch.name}:`, err.message);
        processResults.push({ name: ch.name, status: 'error', reason: err.message });
      }
    }

    return res.status(200).json({ 
      success: true, 
      videos_upserted: totalVideosUpserted,
      channels_processed: channelsToProcess.length,
      results: processResults
    });

  } catch (err: any) {
    console.error('[refresh-videos] fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
