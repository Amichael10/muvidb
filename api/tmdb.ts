import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './_lib/rateLimit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const TMDB_BASE = 'https://api.themoviedb.org/3';

// Only allow the specific TMDB endpoints the app actually uses.
// Keeps this from being an open proxy that burns quota.
const ALLOWED_ENDPOINTS = [
  /^\/search\/movie$/,
  /^\/discover\/movie$/,
  /^\/movie\/\d+$/,
  /^\/person\/\d+$/,
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { endpoint, ...params } = req.query;

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'Missing endpoint' });
  }

  if (!ALLOWED_ENDPOINTS.some(pattern => pattern.test(endpoint))) {
    return res.status(403).json({ error: 'Endpoint not permitted' });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    console.error('TMDB_API_KEY is not set');
    return res.status(500).json({ error: 'TMDB not configured' });
  }

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  try {
    const tmdbRes = await fetch(url.toString());
    const data = await tmdbRes.json();
    return res.status(tmdbRes.status).json(data);
  } catch (error) {
    console.error('TMDB proxy error:', error);
    return res.status(500).json({ error: 'Failed to reach TMDB' });
  }
}
