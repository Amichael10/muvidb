import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';
import { isValidAuth } from '../_lib/auth';
import { ADAPTERS, upsertShowtimes, type CinemaRow } from '../_lib/cinema-adapters';

export const config = { maxDuration: 60 };

// ── YouTube Settings & Helpers ────────────────────────────────────────────────
const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytGet(endpoint: string, params: Record<string, string>) {
  if (!YT_KEY) throw new Error('YOUTUBE_API_KEY is missing in environment');
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
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

function cleanTitle(raw: string): string {
  let t = raw.replace(/\|\|[^|]+\|\|/g, '').replace(/\([A-Z][A-Z\s,]{6,}\)/g, '').trim();
  return t.split(/\s+/).map(w => w.length <= 3 && w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();
  if (!(await isValidAuth(req))) return res.status(401).json({ error: 'Unauthorized' });

  const { task } = req.query;

  try {
    switch (task) {
      case 'showtimes': return await handleShowtimes(req, res);
      case 'videos':    return await handleVideos(req, res);
      case 'tmdb':      return await handleTMDB(req, res);
      case 'kava':      return await handleKava(req, res);
      default:
        return res.status(400).json({ error: 'Invalid task' });
    }
  } catch (err: any) {
    console.error(`[cron/sync] Task ${task} failed:`, err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── TASK: SHOWTIMES ──────────────────────────────────────────────────────────
async function handleShowtimes(req: VercelRequest, res: VercelResponse) {
  const { data: cinemas } = await supabase.from('cinemas').select('*').eq('scrape_enabled', true).limit(15);
  if (!cinemas) return res.status(200).json({ message: 'No cinemas to scrape' });

  const results = [];
  for (const cinema of cinemas) {
    try {
      const adapter = ADAPTERS[cinema.scrape_adapter];
      if (!adapter) continue;
      const scraped = await adapter(cinema);
      const stats = await upsertShowtimes(cinema.id, scraped.showtimes, cinema.scrape_adapter);
      results.push({ name: cinema.name, ...stats });
    } catch (e: any) { results.push({ name: cinema.name, error: e.message }); }
  }
  return res.status(200).json({ task: 'showtimes', results });
}

// ── TASK: VIDEOS ─────────────────────────────────────────────────────────────
async function handleVideos(req: VercelRequest, res: VercelResponse) {
  if (!YT_KEY) throw new Error('YT_KEY missing');
  const { data: channels } = await supabase.from('channels').select('*');
  if (!channels) return res.status(200).json({ message: 'No channels' });

  let totalUpserted = 0;

  for (const ch of channels) {
    try {
      const handle = ch.channel_handle?.replace(/^@/, '');
      let uploadsId = '';
      let discoveredChannelId = ch.channel_id;

      if (discoveredChannelId) {
        const d = await ytGet('channels', { part: 'contentDetails', id: discoveredChannelId });
        uploadsId = d.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      } else if (handle) {
        const d = await ytGet('channels', { part: 'contentDetails', forHandle: handle });
        if (d.items?.[0]) {
          discoveredChannelId = d.items[0].id;
          uploadsId = d.items[0].contentDetails?.relatedPlaylists?.uploads;
          if (discoveredChannelId) {
            await supabase.from('channels').update({ channel_id: discoveredChannelId }).eq('id', ch.id);
          }
        }
      }

      if (!uploadsId) continue;

      const plData = await ytGet('playlistItems', { part: 'snippet', playlistId: uploadsId, maxResults: '10' });
      if (!plData.items?.length) continue;

      const videoIds = plData.items.map((i: any) => i.snippet.resourceId.videoId).join(',');
      const vData = await ytGet('videos', { part: 'contentDetails', id: videoIds });

      const videoRows = plData.items.map((item: any) => {
        const v = vData.items?.find((vd: any) => vd.id === item.snippet.resourceId.videoId);
        return {
          channel_id: ch.id,
          video_id: item.snippet.resourceId.videoId,
          title: item.snippet.title,
          thumbnail_url: item.snippet.thumbnails?.medium?.url,
          published_at: item.snippet.publishedAt,
          duration_seconds: v ? parseDuration(v.contentDetails.duration) : 0,
          match_status: 'unmatched'
        };
      });

      await supabase.from('channel_videos').upsert(videoRows, { onConflict: 'channel_id,video_id' });
      totalUpserted += videoRows.length;
    } catch (e: any) {
      console.error(`[cron/sync] Failed channel ${ch.name}:`, e.message);
    }
  }
  return res.status(200).json({ task: 'videos', status: 'completed', upserted: totalUpserted });
}

// ── TASK: TMDB ───────────────────────────────────────────────────────────────
async function handleTMDB(req: VercelRequest, res: VercelResponse) {
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&sort_by=popularity.desc`;
  const resData = await fetch(url).then(r => r.json());
  return res.status(200).json({ task: 'tmdb', imported: resData.results?.length || 0 });
}

// ── TASK: KAVA ───────────────────────────────────────────────────────────────
async function handleKava(req: VercelRequest, res: VercelResponse) {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY missing');
  // Kava logic...
  return res.status(200).json({ task: 'kava', status: 'ready' });
}
