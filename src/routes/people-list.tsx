import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * People list: first page (20) by popularity — matches PeopleList.jsx default
 * mount query (role=All, sort=popularity, no search).
 */
export { default } from '../pages/PeopleList';

export async function loader() {
  const { data: rows, error } = await supabaseServer
    .from('people')
    .select(`
      id, slug, name, photo_url,
      popularity_score, is_verified,
      known_for_department,
      credits(id, role)
    `)
    .order('popularity_score', { ascending: false })
    .range(0, 19);

  if (error || !rows?.length) {
    return data({ people: [], seeded: false }, { headers: { 'Cache-Control': CACHE_OK } });
  }

  return data(
    { people: rows, seeded: true },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}

export function meta() {
  const title = 'Nollywood Actors & Filmmakers | MuviDB';
  const description =
    'Browse Nollywood actors, directors, and creatives. Explore talent and filmography on MuviDB — the home of Nollywood.';
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
