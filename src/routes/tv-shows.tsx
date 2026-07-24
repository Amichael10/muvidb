import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';
import { getShowName } from '../utils/series';

/**
 * TV Shows: first 48 parent series by created_at — matches TVShows.jsx
 * defaults (no platform/search, sort=newest). Light grouping for first paint;
 * full client grouping still runs on filter changes.
 */
export { default } from '../pages/TVShows';

const COLUMNS = `
  id, title, poster_url, backdrop_url, year, source, release_type, genres,
  streaming_links, youtube_watch_url, view_count, average_rating, liked_percent,
  audience_rating, tmdb_rating, runtime_minutes, synopsis, tagline,
  season_count, episode_count, content_type, slug,
  film_genres(genres(name))
`;

function seedTransform(rows: any[]) {
  return rows.map((film) => {
    const related =
      film.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) || [];
    const genres =
      related.length > 0
        ? related
        : Array.isArray(film.genres)
          ? film.genres.filter(Boolean)
          : [];
    const showName = getShowName(film.title);
    return {
      ...film,
      genres,
      title: showName,
      original_title: film.title,
      episodes_list: [{ ...film, genres }],
      is_series_group: true,
      episodes_count: 1,
    };
  });
}

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const platform = url.searchParams.get('platform') || '';

  let query = supabaseServer
    .from('films')
    .select(COLUMNS, { count: 'exact' })
    .eq('content_type', 'series')
    .is('series_id', null);

  if (platform === 'youtube') {
    query = query.eq('source', 'youtube');
  } else if (platform) {
    query = query.eq('release_type', platform);
  }

  query = query.order('created_at', { ascending: false }).range(0, 47);

  const { data: rows, error, count } = await query;

  if (error || !rows?.length) {
    return data(
      { shows: [], totalCount: 0, seeded: false, platform },
      { headers: { 'Cache-Control': CACHE_OK } },
    );
  }

  return data(
    {
      shows: seedTransform(rows),
      totalCount: count || rows.length,
      seeded: true,
      platform,
    },
    { headers: { 'Cache-Control': CACHE_OK } },
  );
}

export function meta() {
  const title = 'Nollywood TV Shows & Series | MuviDB';
  const description =
    'Browse Nollywood TV series and streaming shows. Find where to watch on MuviDB.';
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
