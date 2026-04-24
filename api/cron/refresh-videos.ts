import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { isValidAuth } from '../_lib/auth';

const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytGet(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY! }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`YouTube /${endpoint} ${res.status}: ${errorBody}`);
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
  
  // Basic auth check
  if (!(await isValidAuth(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { channelId } = req.query;

  try {
    if (!YT_KEY) throw new Error('YOUTUBE_API_KEY missing');

    let channelsToProcess = [];
    if (channelId) {
      const { data: channel } = await supabase.from('channels').select('*').eq('id', channelId).single();
      if (!channel) return res.status(404).json({ error: 'Channel not found' });
      channelsToProcess = [channel];
    } else {
      const { data: channels } = await supabase.from('channels').select('*');
      channelsToProcess = channels || [];
    }

    let videosUpserted = 0;

    for (const ch of channelsToProcess) {
      try {
        const handle = ch.channel_handle?.replace(/^@/, '');
        let uploadsId = '';

        if (ch.channel_id) {
           const d = await ytGet('channels', { part: 'contentDetails', id: ch.channel_id });
           uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        } else if (handle) {
           const d = await ytGet('channels', { part: 'contentDetails', forHandle: handle });
           uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
        }

        if (!uploadsId) continue;

        // Fetch first 50 videos
        const plData = await ytGet('playlistItems', { 
          part: 'snippet', 
          playlistId: uploadsId, 
          maxResults: '50' 
        });

        if (!plData.items?.length) continue;

        const videoIds = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
        const vData = await ytGet('videos', { part: 'contentDetails,snippet', id: videoIds });

        const videoRows = vData.items.map((v: any) => ({
          channel_id: ch.id,
          video_id: v.id,
          title: v.snippet.title,
          thumbnail_url: v.snippet.thumbnails?.high?.url || v.snippet.thumbnails?.medium?.url,
          published_at: v.snippet.publishedAt,
          duration_seconds: parseDuration(v.contentDetails.duration),
          match_status: 'unmatched'
        }));

        const { error: upsertErr } = await supabase.from('channel_videos').upsert(videoRows, { 
          onConflict: 'channel_id,video_id' 
        });

        if (!upsertErr) {
          videosUpserted += videoRows.length;
          // Update last fetched timestamp
          await supabase.from('channels').update({ 
            videos_last_fetched_at: new Date().toISOString() 
          }).eq('id', ch.id);
        }
      } catch (err: any) {
        console.error(`Error processing channel ${ch.name}:`, err.message);
      }
    }

    return res.status(200).json({ 
      success: true, 
      videos_upserted: videosUpserted,
      channels_processed: channelsToProcess.length
    });

  } catch (err: any) {
    console.error('[refresh-videos] failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
