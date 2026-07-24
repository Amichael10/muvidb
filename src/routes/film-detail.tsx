import { data } from 'react-router';
import { filmSeo, baseUrlFrom } from '../lib/seo.server';
import { toMeta, CACHE_OK, CACHE_404 } from '../lib/seo';

/**
 * Route wrapper for the film detail page. The page component is unchanged and
 * still fetches its own display data client-side; this loader exists purely to
 * build the SEO head server-side, replacing what api/seo.ts used to inject.
 */
export { default } from '../pages/FilmDetail';

export async function loader({ params, request }: { params: any; request: Request }) {
  const base = baseUrlFrom(request);
  const { seo, status } = await filmSeo(String(params.slug), base);
  return data({ seo }, {
    headers: { 'Cache-Control': status === 200 ? CACHE_OK : CACHE_404 },
  });
}

export function meta({ data: d }: { data: any }) {
  return toMeta(d?.seo);
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}
