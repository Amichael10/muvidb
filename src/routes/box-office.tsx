import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

export { default } from '../pages/BoxOffice';

export async function loader() {
  try {
    const [filmsRes, playsRes, youtubeRes] = await Promise.all([
      supabaseServer
        .from('films')
        .select(`
          id,
          title,
          slug,
          year,
          poster_url,
          backdrop_url,
          genres,
          box_office_domestic,
          box_office_opening_weekend,
          box_office_currency,
          distributor,
          streaming_links,
          credits (
            role,
            person:people (
              id,
              name
            )
          ),
          film_companies (
            role,
            company:companies (
              id,
              name
            )
          )
        `)
        .gt('box_office_domestic', 0)
        .order('box_office_domestic', { ascending: false }),

      supabaseServer
        .from('plays')
        .select(`
          id,
          title,
          slug,
          year,
          poster_url,
          banner_url,
          venue,
          city,
          playwright,
          director,
          producer,
          run_start_date,
          run_end_date,
          box_office_domestic,
          box_office_tickets_sold,
          box_office_currency,
          box_office_source,
          box_office_metrics
        `)
        .gt('box_office_domestic', 0)
        .order('box_office_domestic', { ascending: false }),

      supabaseServer
        .from('films')
        .select(`
          id,
          title,
          slug,
          year,
          poster_url,
          backdrop_url,
          genres,
          view_count,
          runtime_minutes,
          duration,
          language,
          release_date,
          liked_percent,
          source_video_id,
          youtube_watch_url,
          credits (
            role,
            person:people (
              id,
              name
            )
          )
        `)
        .gt('view_count', 0)
        .order('view_count', { ascending: false })
        .limit(100)
    ]);

    const films = filmsRes.data || [];
    const plays = playsRes.data || [];
    const youtubeFilms = youtubeRes.data || [];

    return data(
      { films, plays, youtubeFilms, seeded: true },
      { headers: { 'Cache-Control': CACHE_OK } }
    );
  } catch (err) {
    console.error('Box office loader error:', err);
    return data(
      { films: [], plays: [], youtubeFilms: [], seeded: false },
      { headers: { 'Cache-Control': CACHE_OK } }
    );
  }
}
