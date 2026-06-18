import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { checkRateLimit } from './_lib/rateLimit';
import { isValidAuth } from './_lib/auth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const YT_KEY = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function ytGet(endpoint: string, params: Record<string, string>) {
  if (!YT_KEY) throw new Error('YOUTUBE_API_KEY is missing in environment');
  const url = new URL(`${YT_BASE}/${endpoint}`);
  Object.entries({ ...params, key: YT_KEY }).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`YouTube API Error: ${res.status}`);
  return res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { id, search, category, featured, action, query: ytQuery } = req.query;

  // ── YouTube Admin Search ───────────────────────────────────────────────────
  if (action === 'yt_search') {
    try {
      const authOk = await isValidAuth(req);
      if (!authOk.valid) return res.status(401).json({ error: 'Unauthorized' });
    } catch (e: any) {
      return res.status(401).json({ error: e.message });
    }

    if (!ytQuery) return res.status(400).json({ error: 'Query is required' });

    try {
      const searchData = await ytGet('search', {
        part: 'snippet',
        q: ytQuery as string,
        type: 'channel',
        maxResults: '12'
      });

      if (!searchData.items?.length) return res.status(200).json({ items: [] });

      const channelIds = searchData.items.map((i: any) => i.snippet.channelId).join(',');
      
      const channelData = await ytGet('channels', {
        part: 'snippet,statistics,contentDetails',
        id: channelIds
      });

      const results = channelData.items.map((c: any) => ({
        id: c.id,
        name: c.snippet.title,
        handle: c.snippet.customUrl || '',
        description: c.snippet.description,
        thumbnail: c.snippet.thumbnails?.medium?.url || c.snippet.thumbnails?.default?.url,
        subscriberCount: parseInt(c.statistics?.subscriberCount || '0'),
        videoCount: parseInt(c.statistics?.videoCount || '0'),
        uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads
      }));

      return res.status(200).json({ items: results });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }

  // ── Single Channel Detail ──────────────────────────────────────────────────
  if (id && !Array.isArray(id)) {
    // Fetch channel
    const { data: channel, error: channelErr } = await supabase
      .from('channels')
      .select('*')
      .eq('id', id)
      .single();

    if (channelErr?.code === 'PGRST116' || !channel) return res.status(404).json({ error: 'Channel not found' });
    if (channelErr) return res.status(500).json({ error: 'Failed to fetch channel' });

    // Fetch saved videos (most recent first)
    const { data: videos } = await supabase
      .from('channel_videos')
      .select('id, video_id, title, thumbnail_url, published_at, duration_seconds, film_id, match_status')
      .eq('channel_id', id)
      .order('published_at', { ascending: false })
      .limit(50);

    // Fetch owner person details if linked
    let owner = null;
    if (channel.owner_person_id) {
      const { data: person } = await supabase
        .from('people')
        .select('id, name, photo_url, known_for_department')
        .eq('id', channel.owner_person_id)
        .single();
      owner = person;
    }

    // Fetch flag count
    const { count: flagCount } = await supabase
      .from('channel_flags')
      .select('id', { count: 'exact', head: true })
      .eq('channel_id', id)
      .eq('status', 'pending');

    return res.status(200).json({
      channel,
      videos: videos ?? [],
      owner,
      flagCount: flagCount ?? 0,
    });
  }

  // ── Channel List ───────────────────────────────────────────────────────────
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let dbQuery = supabase
    .from('channels')
    .select(
      'id, name, channel_handle, channel_url, description, category, country, ' +
      'subscriber_count, thumbnail_url, banner_url, is_featured, ' +
      'owner_person_id, owner_name, videos_last_fetched_at'
    )
    .range(offset, offset + limit - 1)
    .order('subscriber_count', { ascending: false, nullsFirst: false });

  if (search) {
    const formattedQuery = (search as string).trim().split(/\s+/).join(':* & ') + ':*';
    dbQuery = dbQuery.textSearch('name', formattedQuery);
  }
  if (category && category !== 'All') dbQuery = dbQuery.eq('category', category);
  if (featured === 'true') dbQuery = dbQuery.eq('is_featured', true);

  const { data, error } = await dbQuery;

  if (error) {
    console.error('channels query error:', error);
    return res.status(500).json({ error: 'Failed to fetch channels' });
  }

  return res.status(200).json({ channels: data ?? [], limit, offset });
}
