import type { VercelRequest, VercelResponse } from '@vercel/node';
import { embedWithCohere, hasCohere, rerankWithCohere } from './_lib/ai_service.js';
import { supabase } from './_lib/supabase.js';

export const maxDuration = 30;

/**
 * Semantic ranking without hammering Postgres IO.
 *
 * Default (Micro-safe): Cohere Rerank over caller-supplied lexical candidates.
 *   POST { q, mode?: 'rerank', entity?: 'films'|'people', candidates: [{ id, title|name }] }
 *
 * Opt-in pgvector path (films only; needs compute headroom + HNSW):
 *   SEMANTIC_VECTOR_SEARCH=true
 *   POST { q, mode: 'vector', limit? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.method === 'GET' ? req.query : req.body || {};
  const q = String(body.q ?? '').trim();
  const mode = String(body.mode || 'rerank').toLowerCase();
  const entity = String(body.entity || 'films').toLowerCase() === 'people' ? 'people' : 'films';
  const vectorEnabled = process.env.SEMANTIC_VECTOR_SEARCH === 'true';

  if (q.length < 2) {
    return res.status(400).json({ error: 'q too short', films: [], people: [] });
  }
  if (!hasCohere()) {
    return res.status(503).json({ error: 'Cohere not configured', films: [], people: [] });
  }

  try {
    if (mode === 'vector') {
      if (entity === 'people') {
        return res.status(400).json({
          error: 'vector mode is film-only; use mode=rerank with entity=people',
          people: [],
        });
      }
      if (!vectorEnabled) {
        return res.status(503).json({
          error: 'pgvector search disabled (set SEMANTIC_VECTOR_SEARCH=true when compute allows)',
          films: [],
          engine: 'disabled',
        });
      }
      return await vectorSearch(q, body, res);
    }

    return await rerankSearch(q, body, res, entity);
  } catch (err: any) {
    console.error('semantic-search:', err?.message || err);
    return res.status(500).json({
      error: err?.message || 'semantic search failed',
      films: [],
      people: [],
    });
  }
}

async function rerankSearch(
  q: string,
  body: any,
  res: VercelResponse,
  entity: 'films' | 'people',
) {
  const candidates: Array<{ id: string; title?: string; name?: string }> = Array.isArray(
    body.candidates,
  )
    ? body.candidates
    : [];

  const emptyKey = entity === 'people' ? 'people' : 'films';
  if (candidates.length < 2) {
    return res.json({
      [emptyKey]: [],
      films: entity === 'films' ? [] : undefined,
      people: entity === 'people' ? [] : undefined,
      engine: 'cohere-rerank',
      note: 'need >=2 candidates',
    });
  }

  // People: nudge the model that order/typos/nicknames are the same person.
  const query =
    entity === 'people'
      ? `Match this person name (order, nicknames in parentheses, and minor typos allowed): ${q}`.slice(
          0,
          500,
        )
      : q.slice(0, 500);

  const docs = candidates.map((c) =>
    String(c.name || c.title || c.id).slice(0, 500),
  );
  const ranked = await rerankWithCohere(query, docs, {
    topN: Math.min(candidates.length, Number(body.limit) || 24),
  });

  const rows = ranked
    .map((r) => {
      const c = candidates[r.index];
      if (!c?.id) return null;
      return {
        id: c.id,
        title: c.title,
        name: c.name || c.title,
        _score: Math.round(r.relevanceScore * 500),
        _semantic: r.relevanceScore,
      };
    })
    .filter(Boolean);

  if (entity === 'people') {
    return res.json({ people: rows, engine: 'cohere-rerank' });
  }
  return res.json({ films: rows, engine: 'cohere-rerank' });
}

async function vectorSearch(q: string, body: any, res: VercelResponse) {
  const limit = Math.min(48, Math.max(1, Number(body.limit) || 16));
  const [vector] = await embedWithCohere([q.slice(0, 500)], { inputType: 'search_query' });
  if (!vector?.length) return res.json({ films: [], engine: 'cohere-vector' });

  const literal = `[${vector.join(',')}]`;
  const { data: matches, error } = await supabase.rpc('match_films_by_embedding', {
    query_embedding: literal,
    match_count: limit,
    min_similarity: 0.28,
  });
  if (error) throw new Error(error.message);

  const ids = (matches || []).map((m: any) => m.film_id).filter(Boolean);
  if (!ids.length) return res.json({ films: [], engine: 'cohere-vector' });

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

  return res.json({ films: ordered, engine: 'cohere-vector' });
}
