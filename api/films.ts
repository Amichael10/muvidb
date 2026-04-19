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
  'title',
  'poster_url',
  'backdrop_url',
  'year',
  'country',
  'language',
  'runtime_minutes',
  'view_count',
  'average_rating',
  'nfvcb_rating',
  'status',
  'is_featured',
  'synopsis',
  'tagline',
  'release_type',
  'trailer_youtube_id',
  'is_trending',
  'film_genres(genres(name))',
].join(', ');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { country, year, language, search } = req.query;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  let query = supabase.from('films').select(FIELDS).range(offset, offset + limit - 1);

  if (search) query = query.ilike('title', `%${search}%`);
  if (country) query = query.eq('country', country);
  if (year) query = query.eq('year', Number(year));
  if (language) query = query.eq('language', language);

  const { data, error } = await query;

  if (error) {
    console.error('films query error:', error);
    return res.status(500).json({ error: 'Failed to fetch films' });
  }

  const films = ((data ?? []) as any[]).map(f => ({
    ...f,
    film_genres: undefined,
    genres: f.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) ?? [],
  }));

  return res.status(200).json({ films, limit, offset });
}
