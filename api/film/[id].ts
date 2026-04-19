import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const PUBLIC_FIELDS = [
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
  'film_watch_links(id, distributor, url)',
].join(', ');

export default async function handler(req: VercelRequest, res: VercelResponse) {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || Array.isArray(id)) return res.status(400).json({ error: 'Invalid film id' });

  const isAuthenticated = Boolean(req.headers['authorization']);

  let selectFields = PUBLIC_FIELDS;

  // TODO: AUTHENTICATED FIELDS
  // When isAuthenticated is true, extend selectFields to also include:
  //
  //   Credits:
  //     film_credits(role, character_name, people(id, name, photo_url, bio))
  //
  //   Streaming availability:
  //     film_streaming(platform, url, region, available_from, available_until)
  //
  //   Showtimes:
  //     film_showtimes(cinema_name, location, showtime, format, ticket_url)
  //
  // Then map those joins onto the response object the same way genres are
  // flattened below — strip the raw join key and expose clean arrays:
  //   credits: [{ role, character_name, person: { id, name, photo_url, bio } }]
  //   streaming: [{ platform, url, region, available_from, available_until }]
  //   showtimes: [{ cinema_name, location, showtime, format, ticket_url }]
  // END TODO

  const { data, error } = await supabase
    .from('films')
    .select(selectFields)
    .eq('id', id)
    .single();

  if (error?.code === 'PGRST116' || !data) {
    return res.status(404).json({ error: 'Film not found' });
  }

  if (error) {
    console.error('film query error:', error);
    return res.status(500).json({ error: 'Failed to fetch film' });
  }

  const raw = data as any;
  const film = {
    ...raw,
    film_genres: undefined,
    genres: raw.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) ?? [],
    watch_links: raw.film_watch_links ?? [],
    film_watch_links: undefined,
  };

  return res.status(200).json({ film });
}
