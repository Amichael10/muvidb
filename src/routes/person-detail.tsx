import { data } from 'react-router';
import { personSeo, baseUrlFrom } from '../lib/seo.server';
import { toMeta, CACHE_OK, CACHE_404 } from '../lib/seo';

export { default } from '../pages/PersonDetail';

export async function loader({ params, request }: { params: any; request: Request }) {
  const base = baseUrlFrom(request);
  // One query serves both the SEO head and the page body — see personSeo's select.
  const { seo, status, data: person } = await personSeo(String(params.slug), base);
  return data({ seo, person }, {
    status,
    headers: { 'Cache-Control': status === 200 ? CACHE_OK : CACHE_404 },
  });
}

export function meta({ data: d }: { data: any }) {
  return toMeta(d?.seo);
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}
