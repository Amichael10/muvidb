import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';

/**
 * Public, per-film cast & crew endpoint.
 *
 * Anti-scraping: `credits` is the most expensive data we own (~82k rows built
 * with OCR/AI/manual work). Read directly from PostgREST with the anon key it
 * could be paged out in ~83 bulk requests (~17s). This route only ever serves
 * ONE film, so once anon SELECT is revoked on the table a scraper must
 * enumerate all ~16.5k films through our edge — where the Cloudflare rate limit
 * applies and the crawl is visible and blockable.
 *
 * Uses the service-role client, so it keeps working after RLS is locked down.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const raw = req.query.filmId;
  const filmId = Array.isArray(raw) ? raw[0] : raw;
  if (!filmId) return res.status(400).json({ error: 'Missing filmId' });
  // Strict UUID check — the id goes into a filter, so never accept anything
  // that isn't exactly one film id.
  if (!UUID_RE.test(filmId)) return res.status(400).json({ error: 'Invalid filmId' });

  const { data, error } = await supabase
    .from('credits')
    .select('id, role, character_name, billing_order, people(id, name, photo_url, popularity_score, slug)')
    .eq('film_id', filmId)
    .order('billing_order', { ascending: true });

  if (error) {
    console.error('[film-credits] query failed:', error.message);
    return res.status(500).json({ error: 'Failed to load credits' });
  }

  // Credits change rarely — cache hard at the edge so this costs us nothing.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ credits: data ?? [] });
}
