import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * Home route wrapper: server-renders the above-the-fold hero rail and edge-caches
 * the result.
 */
export { default } from '../pages/Home';

export async function loader() {
  // Hero only needs a lean row — HeroSection slices to 6 anyway.
  const { data: films, error } = await supabaseServer
    .from('films')
    .select(`
      id, slug, title, poster_url, backdrop_url, year, synopsis, tagline,
      view_count, average_rating, liked_percent, release_type, source,
      streaming_links, youtube_watch_url, trailer_youtube_id, runtime_minutes,
      film_genres(genres(name))
    `)
    .eq('is_featured', true)
    .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
    .order('view_count', { ascending: false })
    .limit(6);

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

export function meta() {
  const title = 'MuviDB | The Ultimate African Film & Entertainment Database';
  const description =
    'Discover Nollywood and African movies, TV shows, cinema showtimes, streaming, cast and crew on MuviDB.';
  return [
    { title },
    { name: 'description', content: description },
    { name: 'robots', content: 'index, follow' },
    { tagName: 'link', rel: 'canonical', href: 'https://muvidb.com/' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: 'https://muvidb.com/' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ];
}

export function headers({ loaderHeaders }: { loaderHeaders: Headers }) {
  return { 'Cache-Control': loaderHeaders.get('Cache-Control') ?? CACHE_OK };
}

