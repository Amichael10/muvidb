import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';
import { getZonedClock } from '../utils/showtimes';

/**
 * Showtimes: all available rows from today Lagos + active cinemas filter list.
 * Matches Showtimes.jsx mount fetches. Client keeps city/date/cinema filters.
 */
export { default } from '../pages/Showtimes';

export async function loader() {
  const today = getZonedClock().date;

  const [showsRes, cinemasRes] = await Promise.all([
    supabaseServer
      .from('showtimes')
      .select(`
        *,
        films(
          id, slug, title, year, poster_url,
          backdrop_url, average_rating, liked_percent,
          film_genres(genres(name))
        ),
        cinemas(
          id, name, chain, city,
          address, google_maps_url
        )
      `)
      .gte('show_date', today)
      .eq('is_available', true)
      .order('show_date')
      .order('show_time'),
    supabaseServer
      .from('cinemas')
      .select('id, name, city, chain')
      .eq('is_active', true)
      .order('name'),
  ]);

  const showtimes = !showsRes.error && showsRes.data ? showsRes.data : [];
  const cinemas = !cinemasRes.error && cinemasRes.data ? cinemasRes.data : [];
  const seeded = showtimes.length > 0;

  return data(
    { showtimes, cinemas, selectedDate: today, seeded },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}

export function meta() {
  const title = 'Cinema Showtimes | MuviDB';
  const description =
    'Live Nollywood cinema showtimes across major chains in Nigeria — find where to watch today on MuviDB.';
  return [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: 'index, follow' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}
