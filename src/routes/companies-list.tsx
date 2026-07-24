import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * Companies list: full ordered archive — matches Companies.jsx mount query.
 * Search stays client-side.
 */
export { default } from '../pages/Companies';

export async function loader() {
  const { data: rows, error } = await supabaseServer
    .from('companies')
    .select(`
      id, name, logo_url, founded_year, description, website,
      film_companies(film_id)
    `)
    .order('name');

  if (error || !rows?.length) {
    return data(
      { companies: [], filmCounts: {}, seeded: false },
      { headers: { 'Cache-Control': CACHE_OK } },
    );
  }

  const filmCounts: Record<string, number> = {};
  for (const company of rows) {
    filmCounts[company.id] = company.film_companies?.length || 0;
  }

  return data(
    { companies: rows, filmCounts, seeded: true },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}

export function meta() {
  const title = 'Nollywood Studios & Companies | MuviDB';
  const description =
    'Browse Nollywood studios and production companies driving African cinema on MuviDB.';
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
