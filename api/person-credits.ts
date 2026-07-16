import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';

/**
 * One person's filmography (credits + the films they belong to). Powers the
 * professional dashboard, and keeps working once anon SELECT is revoked on
 * `credits` (see api/film-credits.ts for the rationale).
 *
 * Serves a single person per request, so — like /api/film-credits — the cast
 * graph can only be enumerated one entity at a time through our edge, where the
 * Cloudflare rate limit applies, rather than bulk-paged out of PostgREST.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const raw = req.query.personId;
  const personId = Array.isArray(raw) ? raw[0] : raw;
  if (!personId) return res.status(400).json({ error: 'Missing personId' });
  if (!UUID_RE.test(personId)) return res.status(400).json({ error: 'Invalid personId' });

  const { data, error } = await supabase
    .from('credits')
    .select('*, films(*)')
    .eq('person_id', personId);

  if (error) {
    console.error('[person-credits] query failed:', error.message);
    return res.status(500).json({ error: 'Failed to load credits' });
  }

  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).json({ credits: data ?? [] });
}
