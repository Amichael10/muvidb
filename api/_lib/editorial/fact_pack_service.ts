import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface FactPack {
  entity: {
    id: string;
    type: string;
    name: string;
    slug?: string;
  };
  facts: Record<string, any>;
  credits?: any[];
  watchLinks?: any[];
  reviews?: any[];
  plays?: any[];
  fact_ids: string[];
}

/**
 * Assembles a verified server-side fact pack directly from MuviDB tables.
 * Cohere model must strictly rely ONLY on statements present in this FactPack.
 */
export async function buildFactPack(entityType: string, entityId: string): Promise<FactPack> {
  const fact_ids: string[] = [];

  if (entityType === 'person') {
    const { data: person } = await supabase
      .from('people')
      .select('*')
      .eq('id', entityId)
      .single();

    const { data: credits } = await supabase
      .from('credits')
      .select('id, role, character_name, billing_order, films(id, title, year, release_type, poster_url)')
      .eq('person_id', entityId)
      .limit(15);

    const { data: stage } = await supabase
      .from('stage_credits')
      .select('id, role, character_name, plays(id, title, venue, city, year)')
      .eq('person_id', entityId)
      .limit(10);

    fact_ids.push(`person:${person?.id}`);
    (credits || []).forEach((c) => fact_ids.push(`credit:${c.id}`));

    return {
      entity: {
        id: entityId,
        type: 'person',
        name: person?.name || 'African Artist',
        slug: person?.slug,
      },
      facts: {
        country: person?.country || 'African Cinema',
        professions: person?.professions || ['Actor'],
        bio: person?.bio || null,
        film_count: person?.film_count || (credits || []).length,
        awards: person?.awards || [],
      },
      credits: (credits || []).map((c: any) => ({
        film: c.films?.title,
        year: c.films?.year,
        role: c.role,
        character: c.character_name,
      })),
      plays: (stage || []).map((s: any) => ({
        play: s.plays?.title,
        venue: s.plays?.venue,
        city: s.plays?.city,
        year: s.plays?.year,
        role: s.role,
      })),
      fact_ids,
    };
  }

  if (entityType === 'movie') {
    const { data: film } = await supabase
      .from('films')
      .select('*')
      .eq('id', entityId)
      .single();

    const { data: watchLinks } = await supabase
      .from('film_watch_links')
      .select('*')
      .eq('film_id', entityId);

    const { data: criticReviews } = await supabase
      .from('critic_reviews')
      .select('*')
      .eq('film_id', entityId);

    const { data: filmCredits } = await supabase
      .from('credits')
      .select('id, role, character_name, people(id, name, photo_url)')
      .eq('film_id', entityId)
      .limit(15);

    fact_ids.push(`film:${film?.id}`);

    return {
      entity: {
        id: entityId,
        type: 'movie',
        name: film?.title || 'Nollywood Production',
        slug: film?.slug,
      },
      facts: {
        year: film?.year,
        release_date: film?.release_date,
        director: film?.director,
        producer: film?.producer,
        synopsis: film?.synopsis,
        is_in_cinemas: film?.is_in_cinemas || false,
        youtube_watch_url: film?.youtube_watch_url,
        imdb_rating: film?.imdb_rating,
        liked_percent: film?.liked_percent,
      },
      watchLinks: watchLinks || [],
      reviews: criticReviews || [],
      credits: (filmCredits || []).map((c: any) => ({
        name: c.people?.name,
        role: c.role,
        character: c.character_name,
      })),
      fact_ids,
    };
  }

  if (entityType === 'play') {
    const { data: play } = await supabase
      .from('plays')
      .select('*')
      .eq('id', entityId)
      .single();

    const { data: stageCredits } = await supabase
      .from('stage_credits')
      .select('id, role, character_name, people(id, name)')
      .eq('play_id', entityId);

    fact_ids.push(`play:${play?.id}`);

    return {
      entity: {
        id: entityId,
        type: 'play',
        name: play?.title || 'Stage Production',
        slug: play?.slug,
      },
      facts: {
        venue: play?.venue,
        city: play?.city,
        country: play?.country || 'Nigeria',
        playwright: play?.playwright,
        director: play?.director,
        run_start_date: play?.run_start_date,
        run_end_date: play?.run_end_date,
        status: play?.status,
        synopsis: play?.synopsis,
      },
      credits: (stageCredits || []).map((s: any) => ({
        name: s.people?.name,
        role: s.role,
        character: s.character_name,
      })),
      fact_ids,
    };
  }

  return {
    entity: { id: entityId, type: entityType, name: 'MuviDB Entity' },
    facts: {},
    fact_ids: [`entity:${entityId}`],
  };
}
