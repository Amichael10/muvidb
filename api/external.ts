import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './_lib/rateLimit';

import { handleCors } from './_lib/cors.js';

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';
const TMDB_BASE = 'https://api.themoviedb.org/3';

const YT_ALLOWED = new Set(['search', 'channels', 'videos', 'playlistItems', 'commentThreads']);
const TMDB_ALLOWED = [ /^\/search\/movie$/, /^\/discover\/movie$/, /^\/movie\/\d+$/, /^\/person\/\d+$/ ];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  console.log(`[API] ${req.method} ${req.url}`);

  if (checkRateLimit(req as any)) {
    console.log(`[API] Rate limit hit for ${req.url}`);
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { provider, endpoint, ...params } = req.query;

  if (provider === 'youtube') {
    if (!endpoint || typeof endpoint !== 'string' || !YT_ALLOWED.has(endpoint)) {
      return res.status(400).json({ error: 'Invalid or missing endpoint' });
    }
    const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error('[API] YouTube API Key is missing');
      return res.status(500).json({ error: 'YouTube API Key not configured in environment variables' });
    }
    const url = new URL(`${YOUTUBE_BASE}/${endpoint}`);
    url.searchParams.set('key', apiKey);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, String(v)));
    try {
      const ytRes = await fetch(url.toString());
      const data = await ytRes.json();
      if (!ytRes.ok) {
        console.error('[YouTube API Error]', ytRes.status, data);
        return res.status(ytRes.status).json(data);
      }
      return res.status(200).json(data);
    } catch (e) { 
      console.error('[API] YouTube Fetch Exception:', e);
      return res.status(500).json({ error: 'Failed to reach YouTube API' }); 
    }
  }

  if (provider === 'tmdb') {
    if (!endpoint || typeof endpoint !== 'string' || !TMDB_ALLOWED.some(p => p.test(endpoint))) {
      return res.status(403).json({ error: 'Endpoint not permitted or missing' });
    }
    const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
    if (!apiKey) {
      console.error('[API] TMDB API Key is missing');
      return res.status(500).json({ error: 'TMDB API Key not configured in environment variables' });
    }
    const url = new URL(`${TMDB_BASE}${endpoint}`);
    url.searchParams.set('api_key', apiKey);
    Object.entries(params).forEach(([k, v]) => v && url.searchParams.set(k, String(v)));
    try {
      const tmdbRes = await fetch(url.toString());
      const data = await tmdbRes.json();
      if (!tmdbRes.ok) {
        console.error('[TMDB API Error]', tmdbRes.status, data);
        return res.status(tmdbRes.status).json(data);
      }
      return res.status(200).json(data);
    } catch (e) { 
      console.error('[API] TMDB Fetch Exception:', e);
      return res.status(500).json({ error: 'Failed to reach TMDB API' }); 
    }
  }

  return res.status(400).json({ error: 'Invalid provider' });
}
