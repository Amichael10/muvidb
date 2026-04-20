import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { checkRateLimit } from './_lib/rateLimit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const FIELDS = [
  'id',
  'name',
  'photo_url',
  'nationality',
  'popularity_score',
  'is_verified',
  'youtube_handle',
  'youtube_stats',
].join(', ');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { search, sort } = req.query;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let query = supabase.from('people').select(FIELDS).range(offset, offset + limit - 1);

  if (search) query = query.ilike('name', `%${search}%`);

  if (sort === 'name') {
    query = query.order('name', { ascending: true });
  } else {
    query = query.order('popularity_score', { ascending: false, nullsFirst: false });
  }

  const { data, error } = await query;

  if (error) {
    console.error('people query error:', error);
    return res.status(500).json({ error: 'Failed to fetch people' });
  }

  return res.status(200).json({ people: data ?? [], limit, offset });
}
