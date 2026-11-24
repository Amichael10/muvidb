import { data } from 'react-router';
import { supabaseServer } from '../lib/supabase.server';
import { CACHE_OK } from '../lib/seo';

/**
 * Home route wrapper: server-renders the Command Hero (featured release +
 * live Nigerian Box Office snapshot) and edge-caches the result.
 */
export { default } from '../pages/Home';

export async function loader() {
  const heroSelect = `
    id, slug, title, poster_url, backdrop_url, year, synopsis, tagline,
    view_count, average_rating, audience_rating, imdb_rating, tmdb_rating, liked_percent,
    release_type, source, is_in_cinemas, coming_soon, streaming_links,
    youtube_watch_url, trailer_youtube_id, runtime_minutes,
    film_genres(genres(name))
  `;

  const boxOfficeSelect = `
    id, slug, title, poster_url, year, distributor,
    box_office_domestic, box_office_currency
  `;

  const [featuredRes, boAllRes, boRecentRes] = await Promise.all([
    supabaseServer
      .from('films')
      .select(heroSelect)
      .eq('is_featured', true)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('is_in_cinemas', { ascending: false })
      .order('year', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(5),
    supabaseServer
      .from('films')
      .select(boxOfficeSelect)
      .gt('box_office_domestic', 0)
      .order('box_office_domestic', { ascending: false })
      .limit(5),
    supabaseServer
      .from('films')
      .select(boxOfficeSelect)
      .gt('box_office_domestic', 0)
      .gte('year', 2025)
      .order('box_office_domestic', { ascending: false })
      .limit(5),
  ]);

  let featuredFilms =
    !featuredRes.error && featuredRes.data
      ? featuredRes.data.map((f: any) => ({
          ...f,
          genres: f.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) || [],
        }))
      : [];

  // Auto-fallback: if no films are manually pinned as featured, pull live cinema / latest releases with backdrops
  if (featuredFilms.length === 0) {
    const { data: fallbackFilms } = await supabaseServer
      .from('films')
      .select(heroSelect)
      .not('backdrop_url', 'is', null)
      .or('source.neq.mubi,source.is.null,countries.cs.{Nigeria}')
      .order('is_in_cinemas', { ascending: false })
      .order('year', { ascending: false })
      .order('view_count', { ascending: false })
      .limit(5);

    featuredFilms = (fallbackFilms || []).map((f: any) => ({
      ...f,
      genres: f.film_genres?.map((fg: any) => fg.genres?.name).filter(Boolean) || [],
    }));
  }

  const boxOfficeAllTime = !boAllRes.error && boAllRes.data ? boAllRes.data : [];
  const boxOfficeRecent = !boRecentRes.error && boRecentRes.data ? boRecentRes.data : [];

  return data(
    { featuredFilms, boxOfficeRecent, boxOfficeAllTime },
    { headers: { 'Cache-Control': CACHE_OK } }
  );
}

export function meta() {
  const title = 'MuviDB | African Film Database, Cinema Showtimes, Box Office & Credits';
  const description =
    'Find where to watch Nollywood and African movies across cinemas, Netflix, Prime Video, and YouTube — plus Nigerian box office, critic verdicts, stage plays, and verified cast & crew credits.';
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
