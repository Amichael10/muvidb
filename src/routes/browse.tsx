import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * Browse route wrapper: server-renders the first page of results and edge-caches
 * per URL (the query string is part of the cache key, and the param space is
 * bounded — genre/country/sort/platform — so the cache stays effective).
 *
 * IMPORTANT: this reproduces the *initial* query that Browse.jsx runs on mount,
 * including its default filter state (yearRange 2000, no ratings/language/title
 * filter, content_type 'movie', first 50 rows). If you change the query or the
 * initial state in Browse.jsx's fetchFilms, change it here too — they are
 * intentionally duplicated rather than shared, because the page builds its query
 * with the browser client and this builds it with the service-role one. Worth
 * folding into one shared builder that takes a client; see docs/SSR_MIGRATION.md.
 *
 * Only URL-derived filters can be server-rendered. Everything the user changes
 * afterwards lives in component state, not the URL, so it stays client-side.
 */
export { default } from '../pages/Browse';

const COLUMNS = `
  id, slug, title, poster_url, backdrop_url, year, language, genres,
  runtime_minutes, view_count, average_rating, liked_percent, languages, audience_rating, tmdb_rating, nfvcb_rating, synopsis, tagline,
  release_type, streaming_links, source, youtube_watch_url`;

const SORTS: Record<string, { column: string; ascending: boolean }> = {
  views: { column: 'view_count', ascending: false },
  rating: { column: 'liked_percent', ascending: false },
  newest: { column: 'created_at', ascending: false },
  oldest: { column: 'year', ascending: true },
};

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const genre = url.searchParams.get('genre') || '';
  const country = url.searchParams.get('country') || '';
  const platform = url.searchParams.get('platform') || '';
  const sort = url.searchParams.get('sort') || 'views';

  // Join strictness mirrors Browse.jsx: inner-join only the dimension actually
  // being filtered on, so unfiltered rows aren't dropped.
  const genreJoin = genre ? 'film_genres!inner(genres!inner(name))' : 'film_genres!left(genres(name))';
  const countryJoin = country
    ? 'film_countries!inner(countries!inner(name))'
    : 'film_countries!left(countries(name))';

  let query = supabaseServer.from('films').select(`${COLUMNS}, ${genreJoin}, ${countryJoin}`);
  if (genre) query = query.in('film_genres.genres.name', [genre]);
  if (country) query = query.in('film_countries.countries.name', [country]);

  query = query.eq('content_type', 'movie');
  query = query.gte('year', 2000); // Browse.jsx's default yearRange
  query = query.or('source.neq.mubi,source.is.null,countries.cs.{"Nigeria"}');

  const cfg = SORTS[sort] || SORTS.views;
  query = query.order(cfg.column, { ascending: cfg.ascending }).range(0, 49);

  const { data: rows, error } = await query;

  // A slow or failed DB must never break the page — fall back to the client
  // fetch Browse already does. Empty means "not seeded", not "no results".
  if (error || !rows) {
    return data({ films: [], seeded: false }, { headers: { 'Cache-Control': CACHE_OK } });
  }

  let films = rows.map((f: any) => {
    const related = f.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) || [];
    return {
      ...f,
      genres: related.length > 0 ? related : (Array.isArray(f.genres) ? f.genres.filter(Boolean) : []),
      countries: f.film_countries?.map((fc: any) => fc.countries?.name).filter(Boolean) || [],
    };
  });

  // Platform is filtered after the query (it needs a JSON check), same as the page.
  if (platform) {
    films = films.filter((f: any) => {
      if (f.release_type === platform) return true;
      if (platform === 'youtube' && f.source === 'youtube') return true;
      let links: Record<string, unknown> = {};
      try {
        links = typeof f.streaming_links === 'string'
          ? JSON.parse(f.streaming_links)
          : (f.streaming_links || {});
      } catch { /* ignore malformed */ }
      return !!links[platform];
    });
  }

  return data({ films, seeded: true }, { headers: { 'Cache-Control': CACHE_OK } });
}

export function meta() {
  const title = 'Nollywood Movies — Browse African Films | MuviDB';
  const description =
    'Browse Nollywood and African movies by genre, country and platform. Find where to watch on MuviDB — the home of Nollywood.';
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
