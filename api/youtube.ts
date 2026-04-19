import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './_lib/rateLimit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const YOUTUBE_BASE = 'https://www.googleapis.com/youtube/v3';

// Only the YouTube Data API endpoints the app actually uses.
const ALLOWED_ENDPOINTS = new Set([
  'search',
  'channels',
  'videos',
  'playlistItems',
  'commentThreads',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { endpoint, ...params } = req.query;

  if (!endpoint || typeof endpoint !== 'string' || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: 'Invalid or missing endpoint' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('YOUTUBE_API_KEY is not set');
    return res.status(500).json({ error: 'YouTube not configured' });
  }

  const url = new URL(`${YOUTUBE_BASE}/${endpoint}`);
  url.searchParams.set('key', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  try {
    const ytRes = await fetch(url.toString());
    const data = await ytRes.json();
    return res.status(ytRes.status).json(data);
  } catch (error) {
    console.error('YouTube proxy error:', error);
    return res.status(500).json({ error: 'Failed to reach YouTube' });
  }
}
