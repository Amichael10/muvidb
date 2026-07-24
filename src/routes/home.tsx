import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * Home route wrapper: server-renders the above-the-fold hero rail and edge-caches
 * the result.
 *
 * Deliberately NOT the whole page. Home has ~15 rails; putting all of them in the
 * loader would serialise ~15 queries against a DB that runs 8–15s under load and
 * has thrown statement timeouts (57014) — on a cache miss that risks blowing the
 * function's time budget, which is the exact regression docs/SSR_MIGRATION.md
 * warns about. The hero is what governs first paint and LCP; the below-the-fold
 * rails keep fetching client-side as they do today, so nothing regresses.
 *
 * Caching is what makes this a win rather than a tax: s-maxage=3600 +
 * stale-while-revalidate means the slow DB is off the per-request path and only
 * one revalidation pays for it.
 */
export { default } from '../pages/Home';

export async function loader() {
  const { data: films, error } = await supabaseServer
    .from('films')
    .select('*, film_genres(genres(name))')
    .eq('is_featured', true)
    .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
    .order('view_count', { ascending: false });

  // Never let a slow/failed DB break the page — fall back to the client fetch
  // that Home already does. An empty array means "not seeded", not "no films".
  const featuredFilms = !error && films
    ? films.map((f: any) => ({
        ...f,
        genres: f.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) || [],
      }))
    : [];

  return data({ featuredFilms }, { headers: { 'Cache-Control': CACHE_OK } });
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}
