import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from './_lib/cors.js';
import { requireApiKey } from './_lib/api_key_guard.js';
import { supabase } from './_lib/supabase.js';

const MAX_FREE_CATALOG_LIMIT = 500;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', message: 'The MuviDB Developer API currently supports GET queries.' });
  }

  // Parse path: /api/v1/films or query _path=films/123
  let rawPath = (req.query._path as string) || '';
  if (!rawPath && req.url) {
    const urlParts = req.url.split('?')[0].split('/');
    const v1Index = urlParts.indexOf('v1');
    if (v1Index !== -1 && v1Index < urlParts.length - 1) {
      rawPath = urlParts.slice(v1Index + 1).join('/');
    }
  }

  const segments = rawPath.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  const resource = segments[0] || '';
  const subId = segments[1] || '';
  const subResource = segments[2] || '';

  // 0. Base Root Status Check (Requires valid key)
  if (!resource || resource === 'status') {
    const key = await requireApiKey(req, res);
    if (!key) return;

    return res.status(200).json({
      status: 'active',
      api_version: 'v1',
      client: {
        organization: key.name,
        tier: key.tier,
        scopes: key.scopes,
        rate_limit_per_min: key.rate_limit_per_min,
      },
      tier_entitlements: {
        tier: key.tier,
        max_page_limit: key.tier === 'free' ? 20 : 100,
        catalog_access_limit: key.tier === 'free' ? MAX_FREE_CATALOG_LIMIT : 'unlimited',
        full_catalog_access: key.tier !== 'free',
        box_office_access: key.tier !== 'free',
        commercial_license: key.tier !== 'free',
        priority_support: key.tier !== 'free',
      },
      available_endpoints: [
        'GET /api/v1/films',
        'GET /api/v1/films/:id',
        'GET /api/v1/films/:id/credits',
        'GET /api/v1/people',
        'GET /api/v1/people/:id',
        'GET /api/v1/credits',
        'GET /api/v1/boxoffice (Pro & Enterprise)',
      ],
      documentation: 'https://muvidb.com/developers'
    });
  }

  // 1. FILMS RESOURCE
  if (resource === 'films') {
    // 1.A Film Credits: GET /api/v1/films/:id/credits
    if (subId && subResource === 'credits') {
      const key = await requireApiKey(req, res, 'credits:read');
      if (!key) return;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subId);
      
      // Resolve film ID first if slug was provided
      let filmId = subId;
      if (!isUuid) {
        const { data: film } = await supabase.from('films').select('id').eq('slug', subId).maybeSingle();
        if (!film) return res.status(404).json({ error: 'Film not found' });
        filmId = film.id;
      }

      const { data: credits, error } = await supabase
        .from('credits')
        .select(`
          id,
          role,
          department,
          credit_order,
          is_lead,
          people(id, name, slug, avatar_url, primary_department)
        `)
        .eq('film_id', filmId)
        .order('credit_order', { ascending: true, nullsFirst: false });

      if (error) return res.status(500).json({ error: 'Failed to fetch film credits' });

      const rawCast = (credits || []).filter(c => c.role === 'Actor' || c.department === 'Cast');
      const rawCrew = (credits || []).filter(c => c.role !== 'Actor' && c.department !== 'Cast');

      const isFree = key.tier === 'free';
      const cast = isFree ? rawCast.slice(0, 10) : rawCast;
      const crew = isFree ? rawCrew.slice(0, 10) : rawCrew;

      return res.status(200).json({
        film_id: filmId,
        cast_count: cast.length,
        crew_count: crew.length,
        total_cast_in_db: rawCast.length,
        total_crew_in_db: rawCrew.length,
        cast,
        crew,
        tier: key.tier,
        is_limited_preview: isFree && (rawCast.length > 10 || rawCrew.length > 10),
        upgrade_url: isFree ? 'https://muvidb.com/developers#pricing' : undefined,
      });
    }

    // 1.B Single Film Detail: GET /api/v1/films/:id
    if (subId) {
      const key = await requireApiKey(req, res, 'films:read');
      if (!key) return;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subId);

      const { data: film, error } = await supabase
        .from('films')
        .select(`
          id,
          slug,
          title,
          original_title,
          synopsis,
          tagline,
          year,
          release_date,
          runtime_minutes,
          language,
          languages,
          poster_url,
          backdrop_url,
          average_rating,
          liked_percent,
          view_count,
          nfvcb_rating,
          release_type,
          trailer_youtube_id,
          film_genres(genres(id, name)),
          film_watch_links(id, platform_name, watch_url, pricing_type)
        `)
        .eq(isUuid ? 'id' : 'slug', subId)
        .eq('is_published', true)
        .maybeSingle();

      if (error) return res.status(500).json({ error: 'Database error fetching film' });
      if (!film) return res.status(404).json({ error: 'Film not found' });

      return res.status(200).json({
        data: {
          ...film,
          genres: (film.film_genres || []).map((fg: any) => fg.genres?.name).filter(Boolean),
          watch_links: film.film_watch_links || [],
          film_genres: undefined,
          film_watch_links: undefined,
        }
      });
    }

    // 1.C List / Search Films: GET /api/v1/films
    const key = await requireApiKey(req, res, 'films:read');
    if (!key) return;

    const isFree = key.tier === 'free';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const maxLimitAllowed = isFree ? 20 : 100;
    const limit = Math.min(maxLimitAllowed, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Gate Free tier catalog to first 500 records
    if (isFree && offset >= MAX_FREE_CATALOG_LIMIT) {
      return res.status(403).json({
        error: 'Free Tier Catalog Limit Reached',
        message: `Free tier API keys are limited to previewing the first ${MAX_FREE_CATALOG_LIMIT} films. Upgrade to Pro for unrestricted access to all 12,000+ films in the catalog.`,
        catalog_limit: MAX_FREE_CATALOG_LIMIT,
        upgrade_url: 'https://muvidb.com/developers#pricing',
        tier: key.tier
      });
    }

    const { search, year, language, sort = 'popular' } = req.query;

    let query = supabase
      .from('films')
      .select('id, slug, title, year, language, runtime_minutes, poster_url, backdrop_url, average_rating, liked_percent, is_trending', { count: 'exact' })
      .eq('is_published', true);

    if (search && typeof search === 'string') {
      query = query.ilike('title', `%${search.trim()}%`);
    }
    if (year) {
      query = query.eq('year', parseInt(year as string));
    }
    if (language && typeof language === 'string') {
      query = query.ilike('language', `%${language.trim()}%`);
    }

    if (sort === 'newest') {
      query = query.order('year', { ascending: false }).order('created_at', { ascending: false });
    } else if (sort === 'rating') {
      query = query.order('average_rating', { ascending: false, nullsFirst: false });
    } else {
      // Default: popular
      query = query.order('is_trending', { ascending: false }).order('view_count', { ascending: false, nullsFirst: false });
    }

    query = query.range(offset, offset + limit - 1);

    const { data: films, error, count } = await query;

    if (error) return res.status(500).json({ error: 'Failed to retrieve films' });

    const effectiveTotal = isFree ? Math.min(MAX_FREE_CATALOG_LIMIT, count || 0) : (count || 0);
    const hasMore = isFree 
      ? (offset + limit < MAX_FREE_CATALOG_LIMIT && (count || 0) > offset + limit)
      : (count || 0) > offset + limit;

    return res.status(200).json({
      data: films || [],
      pagination: {
        page,
        limit,
        total: effectiveTotal,
        has_more: hasMore,
        catalog_tier: isFree ? `Free (Limited to first ${MAX_FREE_CATALOG_LIMIT} films)` : 'Pro / Enterprise (Unlimited Catalog)'
      }
    });
  }

  // 2. PEOPLE RESOURCE
  if (resource === 'people') {
    // 2.A Single Person Detail: GET /api/v1/people/:id
    if (subId) {
      const key = await requireApiKey(req, res, 'people:read');
      if (!key) return;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subId);

      const { data: person, error } = await supabase
        .from('people')
        .select(`
          id,
          slug,
          name,
          avatar_url,
          primary_department,
          biography,
          gender,
          birth_date,
          birth_place,
          film_count,
          social_links,
          credits(
            id,
            role,
            department,
            credit_order,
            is_lead,
            films(id, slug, title, year, poster_url, average_rating)
          )
        `)
        .eq(isUuid ? 'id' : 'slug', subId)
        .maybeSingle();

      if (error) return res.status(500).json({ error: 'Failed to retrieve person details' });
      if (!person) return res.status(404).json({ error: 'Person not found' });

      // Clean up nested credits
      const filmography = (person.credits || [])
        .filter((c: any) => c.films)
        .map((c: any) => ({
          credit_id: c.id,
          role: c.role,
          department: c.department,
          is_lead: c.is_lead,
          film: c.films,
        }));

      return res.status(200).json({
        data: {
          ...person,
          filmography,
          credits: undefined,
        }
      });
    }

    // 2.B List / Search People: GET /api/v1/people
    const key = await requireApiKey(req, res, 'people:read');
    if (!key) return;

    const isFree = key.tier === 'free';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const maxLimitAllowed = isFree ? 20 : 100;
    const limit = Math.min(maxLimitAllowed, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    // Gate Free tier catalog to first 500 records
    if (isFree && offset >= MAX_FREE_CATALOG_LIMIT) {
      return res.status(403).json({
        error: 'Free Tier Catalog Limit Reached',
        message: `Free tier API keys are limited to previewing the first ${MAX_FREE_CATALOG_LIMIT} people. Upgrade to Pro for unrestricted access to all 15,000+ talent and crew members.`,
        catalog_limit: MAX_FREE_CATALOG_LIMIT,
        upgrade_url: 'https://muvidb.com/developers#pricing',
        tier: key.tier
      });
    }

    const { search, department } = req.query;

    let query = supabase
      .from('people')
      .select('id, slug, name, avatar_url, primary_department, film_count', { count: 'exact' });

    if (search && typeof search === 'string') {
      query = query.ilike('name', `%${search.trim()}%`);
    }
    if (department && typeof department === 'string') {
      query = query.ilike('primary_department', `%${department.trim()}%`);
    }

    query = query.order('film_count', { ascending: false, nullsFirst: false }).range(offset, offset + limit - 1);

    const { data: people, error, count } = await query;

    if (error) return res.status(500).json({ error: 'Failed to retrieve people' });

    const effectiveTotal = isFree ? Math.min(MAX_FREE_CATALOG_LIMIT, count || 0) : (count || 0);
    const hasMore = isFree 
      ? (offset + limit < MAX_FREE_CATALOG_LIMIT && (count || 0) > offset + limit)
      : (count || 0) > offset + limit;

    return res.status(200).json({
      data: people || [],
      pagination: {
        page,
        limit,
        total: effectiveTotal,
        has_more: hasMore,
        catalog_tier: isFree ? `Free (Limited to first ${MAX_FREE_CATALOG_LIMIT} people)` : 'Pro / Enterprise (Unlimited Directory)'
      }
    });
  }

  // 3. CREDITS RESOURCE: GET /api/v1/credits
  if (resource === 'credits') {
    const key = await requireApiKey(req, res, 'credits:read');
    if (!key) return;

    const isFree = key.tier === 'free';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const maxLimitAllowed = isFree ? 20 : 100;
    const limit = Math.min(maxLimitAllowed, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    if (isFree && offset >= MAX_FREE_CATALOG_LIMIT) {
      return res.status(403).json({
        error: 'Free Tier Catalog Limit Reached',
        message: `Free tier API keys are limited to previewing the first ${MAX_FREE_CATALOG_LIMIT} credits. Upgrade to Pro for unrestricted full database credits access.`,
        catalog_limit: MAX_FREE_CATALOG_LIMIT,
        upgrade_url: 'https://muvidb.com/developers#pricing',
        tier: key.tier
      });
    }

    const { film_id, person_id, role, department } = req.query;

    let query = supabase
      .from('credits')
      .select(`
        id,
        film_id,
        person_id,
        role,
        department,
        credit_order,
        is_lead,
        films(id, slug, title, year, poster_url),
        people(id, slug, name, avatar_url)
      `, { count: 'exact' });

    if (film_id && typeof film_id === 'string') query = query.eq('film_id', film_id);
    if (person_id && typeof person_id === 'string') query = query.eq('person_id', person_id);
    if (role && typeof role === 'string') query = query.ilike('role', `%${role.trim()}%`);
    if (department && typeof department === 'string') query = query.ilike('department', `%${department.trim()}%`);

    query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: credits, error, count } = await query;
    if (error) return res.status(500).json({ error: 'Failed to retrieve credits' });

    const effectiveTotal = isFree ? Math.min(MAX_FREE_CATALOG_LIMIT, count || 0) : (count || 0);
    const hasMore = isFree 
      ? (offset + limit < MAX_FREE_CATALOG_LIMIT && (count || 0) > offset + limit)
      : (count || 0) > offset + limit;

    return res.status(200).json({
      data: credits || [],
      pagination: {
        page,
        limit,
        total: effectiveTotal,
        has_more: hasMore,
        catalog_tier: isFree ? `Free (Limited to first ${MAX_FREE_CATALOG_LIMIT} credits)` : 'Pro / Enterprise (Unlimited Credits)'
      }
    });
  }

  // 3. BOX OFFICE RESOURCE
  if (resource === 'boxoffice') {
    const key = await requireApiKey(req, res, 'boxoffice:read');
    if (!key) return;

    if (key.tier === 'free') {
      return res.status(403).json({
        error: 'Pro Tier Required',
        message: 'Box Office intelligence (weekend rankings, lifetime gross, and admissions) is exclusive to Pro and Enterprise tiers. Upgrade your key or visit https://muvidb.com/developers#pricing.',
        upgrade_url: 'https://muvidb.com/developers#pricing',
        tier: key.tier
      });
    }

    const { data: rankings, error } = await supabase
      .from('person_box_office_rankings')
      .select('*')
      .order('rank', { ascending: true })
      .limit(50);

    if (error) {
      return res.status(500).json({ error: 'Failed to retrieve box office data', details: error.message });
    }

    return res.status(200).json({
      data: rankings || [],
      updated_at: new Date().toISOString(),
    });
  }

  return res.status(404).json({
    error: 'Endpoint not found',
    message: `Resource '/api/v1/${resource}' is not recognized.`,
    available_resources: ['films', 'people', 'boxoffice', 'status']
  });
}
