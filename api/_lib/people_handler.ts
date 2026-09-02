import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { checkRateLimit } from './rateLimit.js';

import { handleCors } from './cors.js';

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

export async function handlePeople(req: VercelRequest, res: VercelResponse) {
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
    // Do not use textSearch here: `name` is not guaranteed to have a
    // tsvector configuration in every environment and that made ordinary
    // people searches return 500. OR token matching also handles swapped
    // names and partial surnames (e.g. "oluke").
    const tokens = String(search).trim().split(/\s+/).filter(Boolean);
    const clauses = tokens.map(token => `name.ilike.*${token.replace(/[(),]/g, '')}*`).join(',');
    if (clauses) query = query.or(clauses);
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
  res.setHeader('CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json({ people: data ?? [], limit, offset });
}
