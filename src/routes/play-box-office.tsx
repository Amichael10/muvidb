import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK, CACHE_404 } from '../lib/seo';

export { default } from '../pages/PlayBoxOffice';

export async function loader({ params }: { params: any }) {
  const slug = String(params.slug);
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  let query = supabaseServer.from('plays').select('*');
  if (isUUID) {
    query = query.eq('id', slug);
  } else {
    query = query.eq('slug', slug);
  }

  const { data: play, error } = await query.maybeSingle();

  if (error || !play) {
    return data({ play: null }, { status: 404, headers: { 'Cache-Control': CACHE_404 } });
  }

  return data({ play }, { headers: { 'Cache-Control': CACHE_OK } });
}

export function meta({ data: d }: { data: any }) {
  const playTitle = d?.play?.title || 'Stage Play';
  return [
    { title: `${playTitle} – Theatrical Box Office & Admissions | MuviDB` },
    { name: 'description', content: `Live theatrical box office, admissions, ticket categories, and pricing tiers for ${playTitle}.` },
    { property: 'og:title', content: `${playTitle} Box Office | MuviDB` },
  ];
}
