import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export interface CandidateEntity {
  id: string;
  type: 'movie' | 'person' | 'critic' | 'play' | 'company';
  name: string;
  subtext?: string;
  imageUrl?: string;
  country?: string;
  category?: string;
  completenessScore: number;
  data: Record<string, any>;
}

/**
 * Fetch candidate entities for a given content series from MuviDB Postgres tables.
 */
export async function fetchSeriesCandidates(seriesSlug: string, limit = 30): Promise<CandidateEntity[]> {
  switch (seriesSlug) {
    case 'filmography':
    case 'you_know_the_face':
    case 'stage_to_screen': {
      const { data: people } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, country, film_count, professions, bio, profile_completeness')
        .not('photo_url', 'is', null)
        .gte('film_count', seriesSlug === 'you_know_the_face' ? 2 : 4)
        .order('film_count', { ascending: seriesSlug === 'you_know_the_face' })
        .limit(limit * 2);

      return (people || []).map((p) => ({
        id: p.id,
        type: 'person',
        name: p.name,
        subtext: `${p.film_count || 0} credits • ${p.country || 'African Cinema'}`,
        imageUrl: p.photo_url,
        country: p.country,
        category: (p.professions || [])[0] || 'Actor',
        completenessScore: p.profile_completeness || 0.7,
        data: p,
      }));
    }

    case 'behind_the_camera': {
      const { data: crew } = await supabase
        .from('people')
        .select('id, name, slug, photo_url, country, film_count, professions, bio, profile_completeness')
        .not('photo_url', 'is', null)
        .order('film_count', { ascending: false })
        .limit(limit * 3);

      const filteredCrew = (crew || []).filter((p) => {
        const profs = (p.professions || []).map((pr: string) => pr.toLowerCase());
        return profs.some((pr: string) => pr.includes('director') || pr.includes('writer') || pr.includes('cinematographer') || pr.includes('producer') || pr.includes('editor'));
      });

      return filteredCrew.slice(0, limit).map((p) => ({
        id: p.id,
        type: 'person',
        name: p.name,
        subtext: `${(p.professions || []).join(', ')} • ${p.country || 'Nollywood'}`,
        imageUrl: p.photo_url,
        country: p.country,
        category: (p.professions || [])[0] || 'Filmmaker',
        completenessScore: p.profile_completeness || 0.8,
        data: p,
      }));
    }

    case 'where_to_watch':
    case 'weekend_watchlist': {
      const { data: films } = await supabase
        .from('films')
        .select('id, title, slug, poster_url, release_date, year, is_in_cinemas, youtube_watch_url, liked_percent')
        .not('poster_url', 'is', null)
        .order('year', { ascending: false })
        .limit(limit * 2);

      return (films || []).map((f) => ({
        id: f.id,
        type: 'movie',
        name: f.title,
        subtext: `${f.year || 'Cinema'} • ${f.is_in_cinemas ? 'In Cinemas' : 'Streaming Available'}`,
        imageUrl: f.poster_url,
        completenessScore: f.poster_url ? 0.9 : 0.5,
        data: f,
      }));
    }

    case 'critics_say':
    case 'the_critic':
    case 'one_film_two_takes': {
      const { data: critics } = await supabase
        .from('critics')
        .select('id, name, slug, publication, avatar_url, bio, is_verified')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (critics && critics.length > 0) {
        return critics.map((c) => ({
          id: c.id,
          type: 'critic',
          name: c.name,
          subtext: `${c.publication || 'Film Critic'}`,
          imageUrl: c.avatar_url,
          completenessScore: 0.85,
          data: c,
        }));
      }

      // Fallback to films with critic reviews
      const { data: reviews } = await supabase
        .from('critic_reviews')
        .select('id, film_id, critic_name, publication, quote, rating, films(id, title, poster_url)')
        .limit(limit);

      return (reviews || []).map((r: any) => ({
        id: r.films?.id || r.id,
        type: 'movie',
        name: r.films?.title || 'Critic Reviewed Film',
        subtext: `Reviewed by ${r.critic_name || 'Critic'} (${r.publication || 'Review'})`,
        imageUrl: r.films?.poster_url,
        completenessScore: 0.8,
        data: r,
      }));
    }

    case 'whats_on_stage':
    case 'theatre_spotlight': {
      const { data: plays } = await supabase
        .from('plays')
        .select('id, title, slug, venue, city, country, run_start_date, run_end_date, poster_url, status')
        .order('run_start_date', { ascending: false })
        .limit(limit);

      return (plays || []).map((p) => ({
        id: p.id,
        type: 'play',
        name: p.title,
        subtext: `${p.venue || 'Stage'} • ${p.city || 'Lagos'} (${p.status || 'upcoming'})`,
        imageUrl: p.poster_url,
        country: p.country,
        category: 'Theatre',
        completenessScore: 0.85,
        data: p,
      }));
    }

    default: {
      const { data: films } = await supabase
        .from('films')
        .select('id, title, poster_url, year')
        .order('created_at', { ascending: false })
        .limit(limit);

      return (films || []).map((f) => ({
        id: f.id,
        type: 'movie',
        name: f.title,
        subtext: `${f.year || 'Film'}`,
        imageUrl: f.poster_url,
        completenessScore: 0.7,
        data: f,
      }));
    }
  }
}
