import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { checkRateLimit } from './rateLimit.js';

import { handleCors } from './cors.js';

const FIELDS = [
  'id',
  'slug',
  'title',
  'poster_url',
  'backdrop_url',
  'year',
  'language',
  'languages',
  'runtime_minutes',
  'view_count',
  'average_rating',
  'liked_percent',
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

export async function handleFilms(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (checkRateLimit(req as unknown as Request)) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  const { id, country, year, language, search, genre, rating } = req.query;

  // ── Single Film Detail ──────────────────────────────────────────────────────
  if (id && !Array.isArray(id)) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
    const { data, error } = await supabase
      .from('films')
      .select(`
        *,
        film_genres(genre_id, genres(name)),
        film_companies(companies(id, name, logo_url)),
        film_watch_links(id, distributor, url)
      `)
      .eq(isUuid ? 'id' : 'slug', id)
      // Service-role client bypasses the RLS publish gate, so filter here too:
      // an unpublished film must 404 for the public just like it's hidden in lists.
      .eq('is_published', true)
      .single();

    if (error?.code === 'PGRST116' || !data) return res.status(404).json({ error: 'Film not found' });
    if (error) return res.status(500).json({ error: 'Failed to fetch film' });

    const raw = data as any;
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ 
      film: {
        ...raw,
        genres: raw.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) ?? [],
        watch_links: raw.film_watch_links ?? [],
        film_watch_links: undefined,
      } 
    });
  }

  // ── Film List ───────────────────────────────────────────────────────────────
  const limitValue = Math.min(Number(req.query.limit) || 24, 100);
  const offsetValue = Math.max(Number(req.query.offset) || 0, 0);

  let query;

  if (genre) {
    const genres = Array.isArray(genre) ? genre : [genre];
    // Use !inner join for filtering, but define the fields precisely to avoid duplicates
    const JOIN_FIELDS = FIELDS.replace('film_genres(genres(name))', 'film_genres!inner(genres!inner(name))');
    query = supabase.from('films').select(JOIN_FIELDS);
    query = query.in('film_genres.genres.name', genres);
  } else {
    query = supabase.from('films').select(FIELDS);
  }

  // Public endpoint on the service-role client — enforce the publish gate that
  // RLS applies to the anon client everywhere else.
  query = query.eq('is_published', true);

  const searchStr = Array.isArray(search) ? search[0] : search;
  if (searchStr) {
    const formattedQuery = searchStr.trim().split(/\s+/).join(':* & ') + ':*';
    query = query.textSearch('title', formattedQuery);
  }
  if (country) query = query.eq('country', country);
  if (year) query = query.gte('year', Number(year));
  if (language) query = query.eq('language', language);
  if (rating) {
    const ratings = Array.isArray(rating) ? rating : [rating];
    query = query.in('nfvcb_rating', ratings);
  }

  const { data, error } = await query
    .order('view_count', { ascending: false })
    .range(offsetValue, offsetValue + limitValue - 1);

  if (error) {
    console.error('films query error:', error);
    return res.status(500).json({ error: 'Failed to fetch films' });
  }

  const films = ((data ?? []) as any[]).map(f => ({
    ...f,
    film_genres: undefined,
    genres: f.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) ?? [],
  }));

  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=300, stale-while-revalidate=3600');
  return res.status(200).json({ films, limit: limitValue, offset: offsetValue });
}
