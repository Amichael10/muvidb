import type { VercelRequest, VercelResponse } from '@vercel/node';
import { embedWithCohere, hasCohere, rerankWithCohere } from './ai_service.js';
import { supabase } from './supabase.js';

export async function handleSemanticSearch(req: VercelRequest, res: VercelResponse) {
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
    topN: Math.min(Number(body.limit) || 20, candidates.length),
  });

  const byIndex = new Map(candidates.map((c, i) => [i, c]));
  const results = ranked
    .map((r) => {
      const orig = byIndex.get(r.index);
      return orig ? { ...orig, score: r.relevance_score } : null;
    })
    .filter(Boolean);

  res.setHeader(
    'Cache-Control',
    'public, max-age=120, s-maxage=600, stale-while-revalidate=86400',
  );
  return res.json({
    [entity]: results,
    engine: 'cohere-rerank',
    count: results.length,
  });
}

async function vectorSearch(q: string, body: any, res: VercelResponse) {
  const embedding = await embedWithCohere(q.slice(0, 500), 'search_query');
  if (!embedding || !embedding.length) {
    return res.status(502).json({ error: 'Failed to embed query', films: [] });
  }

  const limit = Math.min(Math.max(Number(body.limit) || 20, 1), 50);
  const matchThreshold = Number(body.threshold) || 0.3;

  const { data, error } = await supabase.rpc('match_films_semantic', {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: limit,
  });

  if (error) {
    console.error('match_films_semantic rpc failed:', error.message);
    return res.status(500).json({ error: error.message, films: [] });
  }

  res.setHeader(
    'Cache-Control',
    'public, max-age=300, s-maxage=1800, stale-while-revalidate=86400',
  );
  return res.json({
    films: data || [],
    engine: 'pgvector-cohere',
    count: (data || []).length,
  });
}
