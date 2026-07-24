import { data } from 'react-router';
import { companySeo, baseUrlFrom } from '../lib/seo.server';
import { toMeta, CACHE_OK, CACHE_404 } from '../lib/seo';

export { default } from '../pages/CompanyDetail';

export async function loader({ params, request }: { params: any; request: Request }) {
  const base = baseUrlFrom(request);
  // Route param is :id but may be a slug or a uuid — companySeo handles both.
  const { seo, status } = await companySeo(String(params.id), base);
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
