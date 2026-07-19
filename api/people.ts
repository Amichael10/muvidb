import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase';
import { checkRateLimit } from './_lib/rateLimit';

import { handleCors } from './_lib/cors.js';

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
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { search, sort } = req.query;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let query = supabase.from('people').select(FIELDS).range(offset, offset + limit - 1);

  if (search) {
    const formattedQuery = (search as string).trim().split(/\s+/).join(':* & ') + ':*';
    query = query.textSearch('name', formattedQuery);
  }

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

  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json({ people: data ?? [], limit, offset });
}
