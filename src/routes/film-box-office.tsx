import { data } from 'react-router';
import { filmSeo, baseUrlFrom } from '../lib/seo.server';
import { toMeta, CACHE_OK, CACHE_404 } from '../lib/seo';

export { default } from '../pages/FilmBoxOffice';

export async function loader({ params, request }: { params: any; request: Request }) {
  const base = baseUrlFrom(request);
  const { seo, status, data: film } = await filmSeo(String(params.slug), base);
  return data({ seo, film }, {
    status,
    headers: { 'Cache-Control': status === 200 ? CACHE_OK : CACHE_404 },
  });
}

export function meta({ data: d }: { data: any }) {
  const filmTitle = d?.film?.title || 'Film';
  const year = d?.film?.year ? ` (${d.film.year})` : '';
  return [
    { title: `${filmTitle}${year} – Theatrical Box Office Breakdown | MuviDB` },
    { name: 'description', content: `Complete box office gross, weekly run progression, admissions, and circuit breakdown for ${filmTitle}.` },
    { property: 'og:title', content: `${filmTitle} Box Office | MuviDB` },
  ];
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}
