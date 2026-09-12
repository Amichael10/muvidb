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
      id, name, logo_url, founded_year, description, website, company_type, slug,
      film_companies (
        film_id,
        role,
        films (
          id,
          title,
          year,
          box_office_domestic,
          box_office_worldwide,
          box_office_currency,
          view_count,
          liked_percent,
          average_rating
        )
      )
    `)
    .order('name');

  if (error || !rows?.length) {
    return data(
      { companies: [], filmCounts: {}, companyMetrics: {}, seeded: false },
      { headers: { 'Cache-Control': CACHE_OK } },
    );
  }

  const filmCounts: Record<string, number> = {};
  const companyMetrics: Record<string, {
    filmCount: number;
    totalBoxOffice: number;
    totalViews: number;
    topHit: { title: string; year?: number; boxOffice?: number | null; views?: number | null } | null;
  }> = {};

  for (const company of rows) {
    let boxOffice = 0;
    let views = 0;
    let topHit: { title: string; year?: number; boxOffice?: number | null; views?: number | null } | null = null;
    let maxMetric = 0;

    for (const fc of company.film_companies || []) {
      const rawFilm = (fc as any).films;
      const film: any = Array.isArray(rawFilm) ? rawFilm[0] : rawFilm;
      if (!film) continue;
      const bo = Number(film.box_office_domestic || film.box_office_worldwide || 0);
      const vc = Number(film.view_count || 0);
      if (bo > 0) boxOffice += bo;
      if (vc > 0) views += vc;

      const metric = bo > 0 ? bo : vc;
      if (metric > maxMetric) {
        maxMetric = metric;
        topHit = {
          title: film.title,
          year: film.year ?? undefined,
          boxOffice: bo > 0 ? bo : null,
          views: vc > 0 ? vc : null,
        };
      }
    }

    const count = company.film_companies?.length || 0;
    filmCounts[company.id] = count;
    companyMetrics[company.id] = {
      filmCount: count,
      totalBoxOffice: boxOffice,
      totalViews: views,
      topHit,
    };
  }

  return data(
    { companies: rows, filmCounts, companyMetrics, seeded: true },
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
    { tagName: 'link', rel: 'canonical', href: 'https://muvidb.com/companies' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: 'https://muvidb.com/companies' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}
