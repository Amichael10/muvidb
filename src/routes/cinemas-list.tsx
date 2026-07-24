import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';
import { getZonedClock, isFutureShowtime } from '../utils/showtimes';

/**
 * Cinemas list: active venues + unique-film show counts from today onward.
 * Mirrors Cinemas.jsx fetchCinemas.
 */
export { default } from '../pages/Cinemas';

export async function loader() {
  const { data: cinemas, error } = await supabaseServer
    .from('cinemas')
    .select('id, name, city, address, state, is_active, booking_url')
    .eq('is_active', true)
    .order('city')
    .order('name');

  if (error || !cinemas?.length) {
    return data(
      { cinemas: [], showCounts: {}, seeded: false },
      { headers: { 'Cache-Control': CACHE_OK } },
    );
  }

  const cinemaClock = getZonedClock();
  const { data: showtimes } = await supabaseServer
    .from('showtimes')
    .select('cinema_id, film_id, show_date, show_time')
    .gte('show_date', cinemaClock.date)
    .eq('is_available', true);

  const showCounts: Record<string, number> = {};
  if (showtimes?.length) {
    const sets: Record<string, Set<string>> = {};
    for (const s of showtimes) {
      if (!isFutureShowtime(s, cinemaClock)) continue;
      if (!sets[s.cinema_id]) sets[s.cinema_id] = new Set();
      sets[s.cinema_id].add(s.film_id);
    }
    for (const [cid, set] of Object.entries(sets)) {
      showCounts[cid] = set.size;
    }
  }

  return data(
    { cinemas, showCounts, seeded: true },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}

export function meta() {
  const title = 'Cinemas in Nigeria | MuviDB';
  const description =
    'Find cinemas across Nigeria and see what Nollywood films are playing today on MuviDB.';
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
