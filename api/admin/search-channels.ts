import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isValidAuth } from '../_lib/auth';

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
  if (req.method !== 'GET') return res.status(405).end();

  // 1. Auth Check
  try {
    const authOk = await isValidAuth(req);
    if (!authOk) return res.status(401).json({ error: 'Unauthorized' });
  } catch (e: any) {
    return res.status(401).json({ error: e.message });
  }

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });

  try {
    // Search for channels
    const searchData = await ytGet('search', {
      part: 'snippet',
      q: query as string,
      type: 'channel',
      maxResults: '12'
    });

    if (!searchData.items?.length) return res.status(200).json({ items: [] });

    const channelIds = searchData.items.map((i: any) => i.snippet.channelId).join(',');
    
    // Get detailed channel stats
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
