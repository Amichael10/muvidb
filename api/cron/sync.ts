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
  const startTime = Date.now();

  try {
    if (!task) {
      console.log('[cron/sync] No task specified, running ALL tasks...');
      
      const { data: masterLog } = await supabase.from('sync_logs').insert({
        source: 'master',
        status: 'running',
        message: 'Running all sync tasks...'
      }).select().single();

      const results: any = {};
      const tasks = [
        { name: 'showtimes', fn: runShowtimesSync },
        { name: 'videos', fn: runVideosSync },
        { name: 'tmdb', fn: runTMDBSync }
      ];

      for (const t of tasks) {
        const tStart = Date.now();
        try {
          const res = await t.fn();
          results[t.name] = res;
          await supabase.from('sync_logs').insert({
            source: t.name,
            status: 'success',
            message: `Completed ${t.name} task`,
            details: res,
            duration_ms: Date.now() - tStart,
            items_processed: res.processed || res.upserted || res.imported || 0,
            items_updated: res.upserted || res.imported || 0
          });
        } catch (e: any) {
          results[t.name] = { error: e.message };
          await supabase.from('sync_logs').insert({
            source: t.name,
            status: 'error',
            message: e.message,
            duration_ms: Date.now() - tStart,
            items_failed: 1
          });
        }
      }
      
      if (masterLog) {
        await supabase.from('sync_logs').update({
          status: 'success',
          message: 'All sync tasks completed',
          details: { results, completed_at: new Date().toISOString() },
          duration_ms: Date.now() - startTime
        }).eq('id', masterLog.id);
      }
      
      return res.status(200).json({
        success: true,
        message: 'All sync tasks completed',
        results
      });
    }

    const { data: taskLog } = await supabase.from('sync_logs').insert({
      source: task as string,
      status: 'running',
      message: `Running ${task} task...`
    }).select().single();

    const tStart = Date.now();
    let result: any;
    switch (task) {
      case 'showtimes': result = await runShowtimesSync(); break;
      case 'videos':    result = await runVideosSync(); break;
      case 'tmdb':      result = await runTMDBSync(); break;
      case 'kava':      
        return res.status(200).json({ 
          task: 'kava', 
          status: 'moved_to_github_actions',
          message: 'Kava sync now runs directly in GitHub Actions to bypass Vercel timeout limits.' 
        });
      default:
        return res.status(400).json({ error: 'Invalid task' });
    }

    if (taskLog) {
      await supabase.from('sync_logs').update({
        status: 'success',
        message: `Completed ${task} task`,
        details: { result, completed_at: new Date().toISOString() },
        duration_ms: Date.now() - tStart,
        items_processed: result.processed || result.upserted || result.imported || 0,
        items_updated: result.upserted || result.imported || 0
      }).eq('id', taskLog.id);
    }

    return res.status(200).json(result);
  } catch (err: any) {
    console.error(`[cron/sync] Task ${task} failed:`, err.message);
    await supabase.from('sync_logs').insert({
      source: (task as string) || 'master',
      status: 'error',
      message: err.message,
      duration_ms: Date.now() - startTime,
      items_failed: 1
    });
    return res.status(500).json({ error: err.message });
  }
}

// ── TASK: SHOWTIMES ──────────────────────────────────────────────────────────
async function runShowtimesSync() {
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
    } catch (e: any) { results.push({ name: cinema.name, error: e.message }); }
  }
  return { task: 'showtimes', results };
}

// ── TASK: VIDEOS ─────────────────────────────────────────────────────────────
async function runVideosSync() {
  if (!YT_KEY) throw new Error('YT_KEY missing');
  const { data: channels } = await supabase.from('channels').select('*');
  if (!channels) return { message: 'No channels' };

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
          duration_seconds: v ? parseDuration(v.contentDetails.duration) : 0
        };
      });

      await supabase.from('channel_videos').upsert(videoRows, { onConflict: 'channel_id,video_id' });
      await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', ch.id);
      totalUpserted += videoRows.length;
    } catch (e: any) {
      console.error(`[cron/sync] Failed channel ${ch.name}:`, e.message);
    }
  }
  return { task: 'videos', status: 'completed', upserted: totalUpserted };
}

// ── TASK: TMDB ───────────────────────────────────────────────────────────────
async function runTMDBSync() {
  const TMDB_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
  const url = `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_KEY}&with_origin_country=NG&sort_by=popularity.desc`;
  
  const resData = await fetch(url).then(r => r.json());
  const movies = resData.results || [];
  
  if (movies.length === 0) {
    return { task: 'tmdb', imported: 0, message: 'No movies found' };
  }

  // 1. Get or Create the TMDB Channel
  let { data: channel } = await supabase
    .from('channels')
    .select('id')
    .eq('name', 'TMDB Discover')
    .maybeSingle();
  
  if (!channel) {
    const { data: newChannel, error: chErr } = await supabase
      .from('channels')
      .insert([{ 
        name: 'TMDB Discover', 
        category: 'Discovery',
        description: 'Auto-fetched from TMDB Discover API (Nigeria Origin)'
      }])
      .select()
      .single();
    if (chErr) throw chErr;
    channel = newChannel;
  }

  // 2. Map to channel_videos schema
  const videoRows = movies.map((m: any) => ({
    channel_id: channel!.id,
    video_id: `TMDB_${m.id}`,
    title: m.title,
    description: m.overview,
    thumbnail_url: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : null,
    published_at: m.release_date ? new Date(m.release_date).toISOString() : new Date().toISOString()
  }));

  // 3. Upsert to DB
  const { error: upsertErr } = await supabase
    .from('channel_videos')
    .upsert(videoRows, { onConflict: 'video_id' });

  if (upsertErr) throw upsertErr;

  // 4. Update last fetched timestamp
  await supabase.from('channels').update({ videos_last_fetched_at: new Date().toISOString() }).eq('id', channel.id);

  return { 
    task: 'tmdb', 
    imported: movies.length,
    channel_id: channel.id
  };
}

// ── TASK: KAVA ───────────────────────────────────────────────────────────────
async function handleKava(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({ 
    task: 'kava', 
    status: 'moved_to_github_actions',
    message: 'Kava sync now runs directly in GitHub Actions to bypass Vercel timeout limits.' 
  });
}
