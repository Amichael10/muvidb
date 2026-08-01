import type { VercelRequest, VercelResponse } from '@vercel/node';
import { embedWithCohere, hasCohere } from './_lib/ai_service.js';
import { supabase } from './_lib/supabase.js';

export const maxDuration = 30;

/**
 * Public semantic film search: Cohere query embed → pgvector neighbours.
 * POST { q: string, limit?: number }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const q = String(
    req.method === 'GET' ? req.query.q : req.body?.q ?? ''
  ).trim();
  const limit = Math.min(
    48,
    Math.max(1, Number(req.method === 'GET' ? req.query.limit : req.body?.limit) || 16)
  );

  if (q.length < 2) return res.status(400).json({ error: 'q too short', films: [] });
  if (!hasCohere()) return res.status(503).json({ error: 'Cohere not configured', films: [] });

  try {
    const [vector] = await embedWithCohere([q.slice(0, 500)], { inputType: 'search_query' });
    if (!vector?.length) return res.json({ films: [], engine: 'cohere' });

    const literal = `[${vector.join(',')}]`;
    const { data: matches, error } = await supabase.rpc('match_films_by_embedding', {
      query_embedding: literal,
      match_count: limit,
      min_similarity: 0.28,
    });
    if (error) throw new Error(error.message);

    const ids = (matches || []).map((m: any) => m.film_id).filter(Boolean);
    if (!ids.length) return res.json({ films: [], engine: 'cohere' });

    // Explicit type args: TS cannot infer tuple entries from `any[][]`, so the
    // Map lands as Map<unknown, unknown> and arithmetic on `.get()` fails.
    const simById = new Map<string, number>(
      (matches || []).map((m: any) => [m.film_id, m.similarity] as [string, number]),
    );
    const { data: films, error: filmErr } = await supabase
      .from('films')
      .select(`
        id, slug, title, poster_url, backdrop_url, year, language, runtime_minutes,
        view_count, average_rating, liked_percent, audience_rating, tmdb_rating, nfvcb_rating,
        content_type, youtube_watch_url, release_type, streaming_links, source, countries,
        film_genres!left(genres(name))
      `)
      .in('id', ids)
      .eq('is_published', true);
    if (filmErr) throw new Error(filmErr.message);

    const ordered = (films || [])
      .map((f: any) => ({
        ...f,
        genres: f.film_genres?.map((g: any) => g.genres?.name).filter(Boolean) || [],
        _score: Math.round((simById.get(f.id) || 0) * 500),
        _semantic: simById.get(f.id) || 0,
      }))
      .sort((a: any, b: any) => b._semantic - a._semantic);

    return res.json({ films: ordered, engine: 'cohere' });
  } catch (err: any) {
    console.error('semantic-search:', err?.message || err);
    return res.status(500).json({ error: err?.message || 'semantic search failed', films: [] });
  }
}
