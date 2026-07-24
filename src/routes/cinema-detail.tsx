import { data } from 'react-router';
import { cinemaSeo, baseUrlFrom } from '../lib/seo.server';
import { toMeta, CACHE_OK, CACHE_404 } from '../lib/seo';

export { default } from '../pages/CinemaDetail';

export async function loader({ params, request }: { params: any; request: Request }) {
  const base = baseUrlFrom(request);
  const { seo, status } = await cinemaSeo(String(params.id), base);
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
