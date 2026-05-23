import type { VercelRequest, VercelResponse } from '@vercel/node';
import { checkRateLimit } from './_lib/rateLimit';

/**
 * /api/youtube — server-side proxy for the YouTube Data API v3.
 *
 * Used by the admin UI (src/lib/youtube.js) to fetch channel stats
 * without exposing the API key in the client bundle.
 *
 * Query params:
 *   endpoint  – YouTube API endpoint (e.g. "search", "channels")
 *   + any additional params forwarded to the YouTube API
 *
 * Allowed endpoints (allowlist for security):
 *   search, channels, videos, playlistItems
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const YT_BASE = 'https://www.googleapis.com/youtube/v3';
const ALLOWED_ENDPOINTS = new Set(['search', 'channels', 'videos', 'playlistItems']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as any)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { endpoint, ...params } = req.query;

  // Validate endpoint
  if (!endpoint || typeof endpoint !== 'string' || !ALLOWED_ENDPOINTS.has(endpoint)) {
    return res.status(400).json({ error: `Invalid or missing endpoint. Allowed: ${[...ALLOWED_ENDPOINTS].join(', ')}` });
  }

  // Get API key — YOUTUBE_API_KEY must be set as a server-side env var in Vercel
  // (NOT VITE_YOUTUBE_API_KEY — that is only available at build time, not in serverless functions)
  const apiKey = process.env.YOUTUBE_API_KEY || process.env.VITE_YOUTUBE_API_KEY;
  if (!apiKey) {
    console.error('[api/youtube] YOUTUBE_API_KEY is missing. Go to Vercel → Settings → Environment Variables and add YOUTUBE_API_KEY');
    return res.status(503).json({
      error: 'YouTube API Key not configured on the server. Ask your admin to set YOUTUBE_API_KEY in Vercel environment variables.',
      hint: 'YOUTUBE_API_KEY must be set in Vercel → Project Settings → Environment Variables'
    });
  }

  // Build the YouTube API URL
  const url = new URL(`${YT_BASE}/${endpoint}`);
  url.searchParams.set('key', apiKey);

  // Forward all other query params
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, String(v));
  });

  try {
    console.log(`[api/youtube] Fetching: ${endpoint}`);
    const ytRes = await fetch(url.toString());

    // Read body once
    const data = await ytRes.json();

    if (!ytRes.ok) {
      const errorMsg = data?.error?.message || `YouTube API error ${ytRes.status}`;
      console.error(`[api/youtube] Error from YouTube:`, ytRes.status, errorMsg);
      return res.status(ytRes.status).json({ error: errorMsg });
    }

    return res.status(200).json(data);
  } catch (err: any) {
    console.error('[api/youtube] Unexpected error:', err);
    return res.status(500).json({ error: err.message || 'Failed to reach YouTube API' });
  }
}
