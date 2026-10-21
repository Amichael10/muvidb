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
 *   ?resource=films-credits&filmIds=<a,b,..>  -> cast rows for a few films
 *   ?resource=person-credit-rows&personIds=   -> credit rows for a few people
 *   ?resource=site-stats                      -> catalogue counts for Footer
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PEOPLE = 8;   // mirrors search.js (slices to 8)
const MAX_FILMS = 100;  // mirrors search.js (.limit(100))

// AdvancedSearch matches up to 10 people before looking up their films, so
// person-films allows 10 — slicing to MAX_PEOPLE there would silently drop
// matches from search results.
const MAX_SEARCH_PEOPLE = 10;

// Compare/collaborator views ask about a handful of entities at once. The row
// cap is generous because it is already bounded by MAX_ID_BATCH films — worst
// case is one company's roster, not a walk of the catalogue. Both mirror
// CompanyDetail, the widest caller (.slice(0, 100) films, full cast each).
const MAX_ID_BATCH = 100;
const MAX_ROWS = 3000;
// Prolific Nollywood actors carry several hundred credits each, so the
// two-person comparison needs more headroom than the collaborator panels.
const MAX_COMPARE_ROWS = 1000;
const MAX_SEARCH_FILMS = 300;  // mirrors AdvancedSearch (.limit(300))

/** Parse a comma-separated uuid list, capped. Returns null if any id is bad. */
function parseIdList(raw: string | undefined, cap: number): string[] | null {
  if (!raw) return null;
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, cap);
  if (!ids.length) return null;
  return ids.every((id) => UUID_RE.test(id)) ? ids : null;
}

/** Shared edge-cache headers for the immutable-ish catalogue reads. */
function setCatalogCache(res: VercelResponse) {
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
}

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

      const { data: film, error: filmError } = await supabase.from('films')
        .select('id').eq('id', filmId).eq('is_published', true).maybeSingle();
      if (filmError) throw filmError;
      if (!film) return res.status(404).json({ error: 'Film not found' });

      // person_id is additive for existing callers (they ignore it) and lets
      // the compare views in AdvancedSearch reuse this endpoint.
      const { data, error } = await supabase
        .from('credits')
        .select('id, person_id, role, character_name, billing_order, people(id, name, photo_url, popularity_score, slug)')
        .eq('film_id', filmId)
        .order('billing_order', { ascending: true });
      if (error) throw error;

      setCatalogCache(res);
      return res.status(200).json({ credits: data ?? [] });
    }

    // ---- one person's filmography ----------------------------------------
    if (resource === 'person-credits') {
      const personId = one(req.query.personId);
      if (!personId) return res.status(400).json({ error: 'Missing personId' });
      if (!UUID_RE.test(personId)) return res.status(400).json({ error: 'Invalid personId' });

      const { data, error } = await supabase
        .from('credits')
        .select('*, films!inner(*)')
        .eq('person_id', personId)
        .eq('films.is_published', true);
      if (error) throw error;

      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
      res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
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

      const ids = param.split(',').map((s) => s.trim()).filter(Boolean).slice(0, MAX_SEARCH_PEOPLE);
      if (!ids.length) return res.status(400).json({ error: 'No personIds provided' });
      if (!ids.every((id) => UUID_RE.test(id))) return res.status(400).json({ error: 'Invalid personIds' });

      // AdvancedSearch filters by role and asks for up to 300; search.js passes
      // neither, so its behaviour is unchanged.
      const role = one(req.query.role);
      const askedLimit = Number(one(req.query.limit));
      const limit = Number.isFinite(askedLimit) && askedLimit > 0
        ? Math.min(askedLimit, MAX_SEARCH_FILMS)
        : MAX_FILMS;

      let query = supabase
        .from('credits')
        .select('film_id, films!inner(id)')
        .in('person_id', ids)
        .eq('films.is_published', true);
      if (role && role !== 'all') query = query.ilike('role', `%${role}%`);

      const { data, error } = await query.limit(limit);
      if (error) throw error;

      const filmIds = [...new Set((data ?? []).map((c: any) => c.film_id).filter(Boolean))];
      setCatalogCache(res);
      return res.status(200).json({ filmIds });
    }

    // ---- cast rows for a handful of films --------------------------------
    // Powers CompanyDetail's frequent-collaborators panel and the career
    // passport's co-star list. Returns person_id so callers can group locally.
    if (resource === 'films-credits') {
      const filmIds = parseIdList(one(req.query.filmIds), MAX_ID_BATCH);
      if (!filmIds) return res.status(400).json({ error: 'Missing or invalid filmIds' });

      const { data, error } = await supabase
        .from('credits')
        .select('film_id, person_id, role, character_name, people(id, name, slug, photo_url, known_for_department)')
        .in('film_id', filmIds)
        .limit(MAX_ROWS);
      if (error) throw error;

      setCatalogCache(res);
      return res.status(200).json({ credits: data ?? [] });
    }

    // ---- credit rows for a handful of people -----------------------------
    // Powers AdvancedSearch's two-person comparison. No people embed: the
    // caller already has the person records it is comparing.
    if (resource === 'person-credit-rows') {
      const personIds = parseIdList(one(req.query.personIds), MAX_PEOPLE);
      if (!personIds) return res.status(400).json({ error: 'Missing or invalid personIds' });

      const { data, error } = await supabase
        .from('credits')
        .select('film_id, person_id, role, character_name, billing_order')
        .in('person_id', personIds)
        .limit(MAX_COMPARE_ROWS);
      if (error) throw error;

      setCatalogCache(res);
      return res.status(200).json({ credits: data ?? [] });
    }

    // ---- distinct co-star count for one person ---------------------------
    // Returns a single integer, so it needs no row cap: the career passport
    // would otherwise under-report for actors with 100+ films.
    if (resource === 'costar-count') {
      const personId = one(req.query.personId);
      if (!personId || !UUID_RE.test(personId)) {
        return res.status(400).json({ error: 'Missing or invalid personId' });
      }

      const { data: own, error: ownError } = await supabase
        .from('credits').select('film_id').eq('person_id', personId);
      if (ownError) throw ownError;

      const filmIds = [...new Set((own ?? []).map((c: any) => c.film_id).filter(Boolean))];
      if (!filmIds.length) return res.status(200).json({ count: 0 });

      const { data, error } = await supabase
        .from('credits').select('person_id')
        .in('film_id', filmIds)
        .neq('person_id', personId);
      if (error) throw error;

      const count = new Set((data ?? []).map((c: any) => c.person_id).filter(Boolean)).size;
      setCatalogCache(res);
      return res.status(200).json({ count });
    }

    // ---- people who hold a given role ------------------------------------
    // The credits half of PeopleList's role filter. The people half reads the
    // people table directly and is unaffected.
    if (resource === 'role-people') {
      const role = one(req.query.role);
      if (!role) return res.status(400).json({ error: 'Missing role' });

      const { data, error } = await supabase
        .from('credits')
        .select(`
          person_id, role,
          people(
            id, slug, name, photo_url,
            popularity_score, is_verified, is_spotlight,
            known_for_department, film_count, gender, nationality,
            created_at, updated_at,
            credits(id, role)
          )
        `)
        .ilike('role', `%${role}%`)
        .limit(150);
      if (error) throw error;

      setCatalogCache(res);
      return res.status(200).json({ credits: data ?? [] });
    }

    // ---- catalogue counts for the footer ---------------------------------
    // Replaces four browser queries, one of which pulled box_office_domestic
    // for every film just to sum it. Aggregated here instead.
    if (resource === 'site-stats') {
      const [filmsRes, creditsRes, cinemasRes, boRes] = await Promise.all([
        supabase.from('films').select('*', { count: 'exact', head: true }),
        supabase.from('credits').select('*', { count: 'exact', head: true }),
        supabase.from('cinemas').select('*', { count: 'exact', head: true }),
        supabase.from('films').select('box_office_domestic').not('box_office_domestic', 'is', null),
      ]);

      let boxOfficeTotal = 0;
      for (const row of boRes.data ?? []) {
        boxOfficeTotal += Number((row as any).box_office_domestic) || 0;
      }

      setCatalogCache(res);
      return res.status(200).json({
        films: filmsRes.count ?? null,
        credits: creditsRes.count ?? null,
        cinemas: cinemasRes.count ?? null,
        boxOfficeTotal,
      });
    }

    return res.status(400).json({ error: 'Unknown resource' });
  } catch (err: any) {
    console.error(`[content:${resource}] query failed:`, err?.message);
    return res.status(500).json({ error: 'Failed to load content' });
  }
}
