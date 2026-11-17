import { supabase, withRetry } from '../db.js';

export async function searchFilms(args: {
  query: string;
  content_type?: string;
  year?: number;
  limit?: number;
}) {
  const limit = Math.min(Math.max(args.limit || 10, 1), 50);
  const cleanQ = (args.query || '').trim();

  let req = supabase
    .from('films')
    .select('id, title, year, content_type, poster_url, synopsis, distributor, average_rating, imdb_rating, language')
    .order('year', { ascending: false, nullsFirst: false })
    .limit(limit);

  if (cleanQ) {
    req = req.or(`title.ilike.%${cleanQ}%,synopsis.ilike.%${cleanQ}%`);
  }

  if (args.content_type) {
    req = req.eq('content_type', args.content_type);
  }

  if (args.year) {
    req = req.eq('year', args.year);
  }

  const { data } = await withRetry(() => req);
  return {
    results_count: data?.length || 0,
    films: data || []
  };
}

export async function getFilmDetails(args: {
  film_id?: string;
  title?: string;
}) {
  let film: any = null;
  if (args.film_id) {
    const { data } = await withRetry(() =>
      supabase
        .from('films')
        .select(`
          id, title, slug, year, content_type, runtime_minutes, duration, synopsis,
          poster_url, backdrop_url, youtube_watch_url, streaming_links, distributor,
          average_rating, imdb_rating, nfvcb_rating, language, countries, genres, awards,
          season_count, episode_count, is_in_cinemas, box_office_domestic, box_office_worldwide
        `)
        .eq('id', args.film_id)
        .maybeSingle()
    );
    film = data;
  } else if (args.title) {
    const { data } = await withRetry(() =>
      supabase
        .from('films')
        .select(`
          id, title, slug, year, content_type, runtime_minutes, duration, synopsis,
          poster_url, backdrop_url, youtube_watch_url, streaming_links, distributor,
          average_rating, imdb_rating, nfvcb_rating, language, countries, genres, awards,
          season_count, episode_count, is_in_cinemas, box_office_domestic, box_office_worldwide
        `)
        .ilike('title', args.title.trim())
        .limit(1)
        .maybeSingle()
    );
    film = data;
  }

  if (!film) {
    return {
      error: `Film not found with ${args.film_id ? `ID: ${args.film_id}` : `Title: ${args.title}`}`
    };
  }

  // Fetch top cast & crew summary
  const { data: credits } = await withRetry(() =>
    supabase
      .from('credits')
      .select('role, character_name, billing_order, people(id, name, slug)')
      .eq('film_id', film.id)
      .order('billing_order', { ascending: true, nullsFirst: false })
      .limit(15)
  );

  const formattedCredits = (credits || []).map((c: any) => ({
    name: c.people?.name || 'Unknown',
    person_id: c.people?.id,
    role: c.role,
    character_name: c.character_name,
    billing_order: c.billing_order
  }));

  const directors = formattedCredits.filter((c: any) => c.role === 'director').map((c: any) => c.name);
  const writers = formattedCredits.filter((c: any) => c.role === 'writer').map((c: any) => c.name);
  const leadCast = formattedCredits.filter((c: any) => c.role === 'actor').slice(0, 8);

  return {
    ...film,
    directors,
    writers,
    lead_cast: leadCast
  };
}

export async function getFilmCredits(args: {
  film_id?: string;
  title?: string;
}) {
  let targetId = args.film_id;
  let targetTitle = args.title;

  if (!targetId && targetTitle) {
    const { data } = await withRetry(() =>
      supabase.from('films').select('id, title').ilike('title', targetTitle!.trim()).limit(1).maybeSingle()
    );
    if (data) {
      targetId = data.id;
      targetTitle = data.title;
    }
  }

  if (!targetId) {
    return {
      error: `Film not found for title "${args.title}"`
    };
  }

  const { data: credits } = await withRetry(() =>
    supabase
      .from('credits')
      .select(`
        id, role, character_name, billing_order, source,
        people(id, name, slug, photo_url, imdb_id)
      `)
      .eq('film_id', targetId)
      .order('billing_order', { ascending: true, nullsFirst: false })
  );

  const cast: any[] = [];
  const crew: any[] = [];

  for (const c of credits || []) {
    const item = {
      person_id: (c as any).people?.id,
      name: (c as any).people?.name || 'Unknown',
      slug: (c as any).people?.slug,
      role: c.role,
      character_name: c.character_name,
      billing_order: c.billing_order,
      imdb_id: (c as any).people?.imdb_id
    };

    if (c.role === 'actor') {
      cast.push(item);
    } else {
      crew.push(item);
    }
  }

  return {
    film_id: targetId,
    film_title: targetTitle,
    total_credits: (credits || []).length,
    cast_count: cast.length,
    crew_count: crew.length,
    cast,
    crew
  };
}

export async function getWhereToWatch(args: {
  title: string;
}) {
  const cleanTitle = (args.title || '').trim();

  const { data: film } = await withRetry(() =>
    supabase
      .from('films')
      .select('id, title, year, content_type, streaming_links, youtube_watch_url, is_in_cinemas, poster_url')
      .ilike('title', `%${cleanTitle}%`)
      .limit(1)
      .maybeSingle()
  );

  if (!film) {
    return { error: `Title "${cleanTitle}" not found in MuviDB.` };
  }

  return {
    film_id: film.id,
    title: film.title,
    year: film.year,
    content_type: film.content_type,
    poster_url: film.poster_url,
    streaming: {
      streaming_links: film.streaming_links || [],
      youtube_watch_url: film.youtube_watch_url || null,
      available_now: !!(film.youtube_watch_url || (Array.isArray(film.streaming_links) && film.streaming_links.length > 0))
    },
    cinema_exhibition: {
      currently_in_cinemas: film.is_in_cinemas || false
    }
  };
}
