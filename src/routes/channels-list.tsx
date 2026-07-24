import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * Channels list: top 96 by subscribers — matches Channels.jsx default
 * (search empty, category All).
 */
export { default } from '../pages/Channels';

const COLUMNS = `
  id, slug, name, banner_url, thumbnail_url, category, country,
  subscriber_count, description, owner_name, is_featured
`;

export async function loader() {
  const { data: rows, error } = await supabaseServer
    .from('channels')
    .select(COLUMNS)
    .order('subscriber_count', { ascending: false, nullsFirst: false })
    .limit(96);

  if (error || !rows?.length) {
    return data({ channels: [], seeded: false }, { headers: { 'Cache-Control': CACHE_OK } });
  }

  return data(
    { channels: rows, seeded: true },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}

export function meta() {
  const title = 'YouTube Channels & Creators | MuviDB';
  const description =
    'Discover Nollywood creators, studios, and YouTube channels shaping African entertainment on MuviDB.';
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
