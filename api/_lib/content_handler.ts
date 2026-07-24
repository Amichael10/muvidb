import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';

/**
 * Protected-content endpoint. Serves the data we don't want bulk-scraped
 * (credits today, reviews next) via the service-role client, one entity at a
 * time, so anon SELECT can be revoked on those tables.
 *
 * Why one function with a `resource` switch instead of a route per shape:
 * Vercel Hobby allows only 12 Serverless Functions per deployment and we're at
 * the cap — a route per shape fails the deploy at "Deploying outputs".
 *
 * Modes:
 *   ?resource=film-credits&filmId=<uuid>      -> one film's cast & crew
 *   ?resource=person-credits&personId=<uuid>  -> one person's filmography
 *   ?resource=person-films&personIds=<a,b,..> -> film ids for search-by-cast
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PEOPLE = 8;   // mirrors search.js (slices to 8)
const MAX_FILMS = 100;  // mirrors search.js (.limit(100))

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export async function handleContent(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const resource = one(req.query.resource);

  try {
    // ---- one film's cast & crew ------------------------------------------
    if (resource === 'film-credits') {
      const filmId = one(req.query.filmId);
      if (!filmId) return res.status(400).json({ error: 'Missing filmId' });
      if (!UUID_RE.test(filmId)) return res.status(400).json({ error: 'Invalid filmId' });

      const { data, error } = await supabase
        .from('credits')
        .select('id, role, character_name, billing_order, people(id, name, photo_url, popularity_score, slug)')
        .eq('film_id', filmId)
        .order('billing_order', { ascending: true });
      if (error) throw error;

      res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      return res.status(200).json({ credits: data ?? [] });
    }

    // ---- one person's filmography ----------------------------------------
    if (resource === 'person-credits') {
      const personId = one(req.query.personId);
      if (!personId) return res.status(400).json({ error: 'Missing personId' });
      if (!UUID_RE.test(personId)) return res.status(400).json({ error: 'Invalid personId' });

      const { data, error } = await supabase
        .from('credits')
        .select('*, films(*)')
        .eq('person_id', personId);
      if (error) throw error;

      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ credits: data ?? [] });
    }

    // ---- one film's reviews (user-written + mined external) ---------------
    if (resource === 'film-reviews') {
      const filmId = one(req.query.filmId);
      if (!filmId) return res.status(400).json({ error: 'Missing filmId' });
      if (!UUID_RE.test(filmId)) return res.status(400).json({ error: 'Invalid filmId' });

      const { data, error } = await supabase
        .from('reviews')
        .select('*, users:user_id (name, avatar_url)')
        .eq('film_id', filmId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Not edge-cached: a user must see their own review immediately after
      // posting, and a stale cache would hide it. Cheap at our traffic, and
      // scrapers are throttled by the edge rate limit regardless.
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ reviews: data ?? [] });
    }

    // ---- search-by-cast: person ids -> film ids ---------------------------
    // Ids only (no roles/character names) and hard-capped, so it can't be
    // turned into a credits dump.
    if (resource === 'person-films') {
      const param = one(req.query.personIds);
      if (!param) return res.status(400).json({ error: 'Missing personIds' });

      const ids = param.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_PEOPLE);
      if (!ids.length) return res.status(400).json({ error: 'No personIds provided' });
      if (!ids.every((id) => UUID_RE.test(id))) return res.status(400).json({ error: 'Invalid personIds' });

      const { data, error } = await supabase
        .from('credits')
        .select('film_id')
        .in('person_id', ids)
        .limit(MAX_FILMS);
      if (error) throw error;

      const filmIds = [...new Set((data ?? []).map((c: any) => c.film_id).filter(Boolean))];
      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
      return res.status(200).json({ filmIds });
    }

    return res.status(400).json({ error: 'Unknown resource' });
  } catch (err: any) {
    console.error(`[content:${resource}] query failed:`, err?.message);
    return res.status(500).json({ error: 'Failed to load content' });
  }
}
