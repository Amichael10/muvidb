import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';

/**
 * "Search by cast" support: given a few person ids, return the film ids they
 * appear in. Exists so search keeps working once anon SELECT is revoked on
 * `credits` (see api/film-credits.ts for the rationale).
 *
 * Deliberately narrow: ids only — no roles, character names, or billing order —
 * and hard-capped, so it can't be turned into a credits dump.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PEOPLE = 8;   // mirrors the caller (search.js slices to 8)
const MAX_FILMS = 100;  // mirrors the caller's .limit(100)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const raw = req.query.personIds;
  const param = Array.isArray(raw) ? raw[0] : raw;
  if (!param) return res.status(400).json({ error: 'Missing personIds' });

  const ids = param.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_PEOPLE);
  if (!ids.length) return res.status(400).json({ error: 'No personIds provided' });
  if (!ids.every((id) => UUID_RE.test(id))) return res.status(400).json({ error: 'Invalid personIds' });

  const { data, error } = await supabase
    .from('credits')
    .select('film_id')
    .in('person_id', ids)
    .limit(MAX_FILMS);

  if (error) {
    console.error('[person-films] query failed:', error.message);
    return res.status(500).json({ error: 'Failed to load films' });
  }

  const filmIds = [...new Set((data ?? []).map((c: any) => c.film_id).filter(Boolean))];
  res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
  return res.status(200).json({ filmIds });
}
