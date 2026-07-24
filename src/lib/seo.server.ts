import { supabaseServer } from './supabase.server';
import type { Seo } from './seo';

export type { Seo };

/**
 * Server-only SEO builders, ported from api/seo.ts.
 *
 * api/seo.ts used to intercept /films/:slug, /people/:slug, /watch/:slug,
 * /channels/:slug, /companies/:slug and /cinemas/:slug via vercel.json, read
 * dist/index.html and inject <title>/og/twitter/JSON-LD plus a synthetic
 * crawlable <main>. Framework mode no longer emits dist/index.html and now
 * server-renders the *real* page, so the synthetic body is obsolete — but the
 * meta, canonical, JSON-LD and robots rules still matter and are preserved here
 * verbatim. The sitemap half of api/seo.ts is untouched and still serves
 * /sitemap*.xml.
 */

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export const clean = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Profiles worth indexing — mirrors isIndexablePerson in api/seo.ts. */
const isIndexablePerson = (person: any, creditCount: number) => {
  if (person?.is_verified || person?.is_spotlight) return true;
  if (Number(person?.film_count || 0) > 0) return true;
  if (creditCount > 0) return true;
  const bio = clean(person?.bio);
  if (bio.length >= 40 && person?.photo_url) return true;
  return false;
};

export const WATCH_NAMES: Record<string, string> = {
  netflix: 'Netflix', prime_video: 'Prime Video', youtube: 'YouTube',
  showmax: 'Showmax', kava: 'Kava', docuth: 'Docuth', cinema: 'In Cinemas',
};

/** Origin of the incoming request, replacing seo.ts's host/x-forwarded-proto read. */
export function baseUrlFrom(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = request.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

const keyFor = (slug: string) => (UUID_RE.test(slug) ? 'id' : 'slug');

const crumbs = (items: { name: string; item: string }[]) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({
    '@type': 'ListItem', position: i + 1, name: it.name, item: it.item,
  })),
});


const notFound = (base: string, what: string, noun: string): Seo => ({
  title: `${what} not found | MuviDB`,
  description: `This ${noun} could not be found on MuviDB.`,
  image: `${base}/filmhouse.png`,
  canonical: base,
  robots: 'noindex, follow',
  jsonLd: [],
});

// ---------------------------------------------------------------- person ----
export async function personSeo(slug: string, base: string) {
  const { data } = await supabaseServer
    .from('people')
    .select('*, credits(role, character_name, films(title, slug, id, year))')
    .eq(keyFor(slug), slug)
    .maybeSingle();

  if (!data) return { seo: notFound(base, 'Person', 'profile'), status: 404, data: null };

  const name = clean(data.name);
  const job = data.known_for_department || 'Actor';
  const creditCount = Array.isArray(data.credits) ? data.credits.length : 0;
  const canonical = `${base}/people/${data.slug || data.id}`;
  const image = data.photo_url || `${base}/filmhouse.png`;
  const description =
    clean(data.bio).slice(0, 155) ||
    `Discover ${name}'s filmography, credits and videos on MuviDB — the home of Nollywood.`;

  // Thin stubs stay noindex so Google can clear "Crawled - not indexed".
  if (!isIndexablePerson(data, creditCount)) {
    return {
      seo: {
        title: `${name} | MuviDB`,
        description: `${name} on MuviDB.`,
        image, canonical, robots: 'noindex, follow', jsonLd: [],
      },
      status: 404,
      data,
    };
  }

  const sameAs = [
    data.instagram_url, data.twitter_url, data.facebook_url,
    data.youtube_handle
      ? `https://youtube.com/${String(data.youtube_handle).replace(/^@?/, '@')}`
      : null,
  ].filter(Boolean);

  return {
    seo: {
      title: `${name} – Nollywood ${job} | MuviDB`,
      description, image, canonical, robots: 'index, follow',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name, url: canonical, image, description, jobTitle: job,
          ...(data.date_of_birth ? { birthDate: data.date_of_birth } : {}),
          ...(data.birthplace ? { birthPlace: clean(data.birthplace) } : {}),
          ...(data.nationality ? { nationality: clean(data.nationality) } : {}),
          ...(data.gender ? { gender: clean(data.gender) } : {}),
          ...(sameAs.length ? { sameAs } : {}),
        },
        crumbs([
          { name: 'Home', item: `${base}/` },
          { name: 'People', item: `${base}/people` },
          { name, item: canonical },
        ]),
      ],
    } as Seo,
    status: 200,
    data,
  };
}

// ------------------------------------------------------------------ film ----
export async function filmSeo(slug: string, base: string) {
  const { data } = await supabaseServer
    .from('films')
    .select('*, film_genres(genres(name)), credits(role, character_name, billing_order, people(name, slug, id))')
    .eq(keyFor(slug), slug)
    .eq('is_published', true)
    .maybeSingle();

  if (!data) return { seo: notFound(base, 'Film', 'title'), status: 404, data: null };

  const movieTitle = clean(data.title);
  const canonical = `${base}/films/${data.slug || data.id}`;
  const image = data.poster_url || data.backdrop_url || `${base}/filmhouse.png`;
  const description =
    clean(data.synopsis).slice(0, 155) ||
    `Where to watch ${movieTitle} in Nigeria — streaming links, cast and details on MuviDB.`;

  const genre = (data.film_genres || []).map((fg: any) => fg.genres?.name).filter(Boolean);

  let streamingLinks: Record<string, string> = {};
  try {
    streamingLinks = typeof data.streaming_links === 'string'
      ? JSON.parse(data.streaming_links)
      : (data.streaming_links || {});
  } catch { /* ignore malformed */ }
  const watchEntries = Object.entries(streamingLinks).filter(([, v]) => !!v);
  if (data.youtube_watch_url) watchEntries.push(['youtube', data.youtube_watch_url]);

  const cast = (data.credits || [])
    .filter((c: any) => c.people)
    .sort((a: any, b: any) => (a.billing_order ?? 999) - (b.billing_order ?? 999));
  const toPerson = (c: any) => ({
    '@type': 'Person',
    name: clean(c.people.name),
    url: `${base}/people/${c.people.slug || c.people.id}`,
  });
  const actors = cast.filter((c: any) => !/direct/i.test(c.role || '')).slice(0, 10).map(toPerson);
  const directors = cast.filter((c: any) => /direct/i.test(c.role || '')).map(toPerson);

  return {
    seo: {
      title: `${movieTitle}${data.year ? ` (${data.year})` : ''} – Where to Watch | MuviDB`,
      description, image, canonical, robots: 'index, follow',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Movie',
          name: movieTitle, url: canonical, image, description,
          ...(data.year ? { datePublished: `${data.year}` } : {}),
          ...(genre.length ? { genre } : {}),
          ...(data.language ? { inLanguage: data.language } : {}),
          ...(data.nfvcb_rating ? { contentRating: data.nfvcb_rating } : {}),
          ...(data.runtime_minutes ? { duration: `PT${data.runtime_minutes}M` } : {}),
          ...(actors.length ? { actor: actors } : {}),
          ...(directors.length ? { director: directors } : {}),
          ...((Number(data.tmdb_rating) > 0 || data.liked_percent != null) ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              // Prefer the real TMDB score (/10); otherwise our unified "% liked" (/100).
              ratingValue: Number(data.tmdb_rating) > 0
                ? Number(data.tmdb_rating).toFixed(1)
                : String(data.liked_percent),
              bestRating: Number(data.tmdb_rating) > 0 ? '10' : '100',
              ratingCount: Math.max(1, Number(data.view_count) || 1),
            },
          } : {}),
          ...(watchEntries.length ? {
            potentialAction: watchEntries.map(([, t]) => ({ '@type': 'WatchAction', target: [t] })),
          } : {}),
        },
        crumbs([
          { name: 'Home', item: `${base}/` },
          { name: 'Movies', item: `${base}/browse` },
          { name: movieTitle, item: canonical },
        ]),
      ],
    } as Seo,
    status: 200,
    data,
  };
}

// ----------------------------------------------------------------- watch ----
export function watchSeo(platform: string, base: string) {
  const platformName = WATCH_NAMES[platform];
  if (!platformName) return { seo: notFound(base, 'Platform', 'platform'), status: 404 };

  const canonical = `${base}/watch/${platform}`;
  const title = `Where to Watch Nollywood on ${platformName} | MuviDB`;
  const description = `Browse every Nollywood movie available on ${platformName}. Find what to watch tonight on MuviDB — the home of Nollywood.`;
  return {
    seo: {
      title, description, canonical, robots: 'index, follow',
      image: `${base}/filmhouse.png`,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title, url: canonical, description,
        about: `Nollywood films available on ${platformName}`,
      }],
    } as Seo,
    status: 200,
  };
}

// --------------------------------------------------------------- channel ----
export async function channelSeo(slug: string, base: string) {
  const { data } = await supabaseServer
    .from('channels').select('*').eq(keyFor(slug), slug).maybeSingle();
  if (!data) return { seo: notFound(base, 'Channel', 'channel'), status: 404, data: null };

  const name = clean(data.name);
  const canonical = `${base}/channels/${data.slug || data.id}`;
  return {
    seo: {
      title: `${name} – Nollywood YouTube Channel | MuviDB`,
      description: clean(data.description).slice(0, 155) || `Watch ${name} on MuviDB.`,
      image: data.thumbnail_url || data.banner_url || `${base}/filmhouse.png`,
      canonical, robots: 'index, follow',
      jsonLd: [crumbs([
        { name: 'Home', item: `${base}/` },
        { name: 'Channels', item: `${base}/channels` },
        { name, item: canonical },
      ])],
    } as Seo,
    status: 200,
    data,
  };
}

// --------------------------------------------------------------- company ----
export async function companySeo(slug: string, base: string) {
  const { data } = await supabaseServer
    .from('companies').select('*').eq(keyFor(slug), slug).maybeSingle();
  if (!data) return { seo: notFound(base, 'Studio', 'company'), status: 404, data: null };

  const name = clean(data.name);
  const canonical = `${base}/companies/${data.slug || data.id}`;
  return {
    seo: {
      title: `${name} – Nollywood Studio & Filmography | MuviDB`,
      description: clean(data.description).slice(0, 155) ||
        `Films, productions and credits from ${name} on MuviDB — the home of Nollywood.`,
      image: data.logo_url || `${base}/filmhouse.png`,
      canonical, robots: 'index, follow',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name, url: canonical,
          ...(data.logo_url ? { logo: data.logo_url } : {}),
        },
        crumbs([
          { name: 'Home', item: `${base}/` },
          { name: 'Companies', item: `${base}/companies` },
          { name, item: canonical },
        ]),
      ],
    } as Seo,
    status: 200,
    data,
  };
}

// ---------------------------------------------------------------- cinema ----
export async function cinemaSeo(id: string, base: string) {
  // cinemas are keyed by id (no slug column)
  const { data } = await supabaseServer
    .from('cinemas').select('*').eq('id', id).maybeSingle();
  if (!data) return { seo: notFound(base, 'Cinema', 'cinema'), status: 404, data: null };

  const name = clean(data.name);
  const loc = [data.city, data.state].filter(Boolean).join(', ');
  const canonical = `${base}/cinemas/${data.id}`;
  return {
    seo: {
      title: `${name}${loc ? ` – ${clean(loc)}` : ''} | Showtimes & Tickets | MuviDB`,
      description: clean(data.description).slice(0, 155) ||
        `Showtimes, screens and tickets for ${name}${loc ? ` in ${clean(loc)}` : ''} on MuviDB.`,
      image: data.logo_url || `${base}/filmhouse.png`,
      canonical, robots: 'index, follow',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'MovieTheater',
          name, url: canonical,
          ...(data.logo_url ? { image: data.logo_url } : {}),
          ...(data.address || loc ? {
            address: {
              '@type': 'PostalAddress',
              ...(data.address ? { streetAddress: clean(data.address) } : {}),
              ...(data.city ? { addressLocality: clean(data.city) } : {}),
              ...(data.state ? { addressRegion: clean(data.state) } : {}),
              addressCountry: 'NG',
            },
          } : {}),
        },
        crumbs([
          { name: 'Home', item: `${base}/` },
          { name: 'Cinemas', item: `${base}/cinemas` },
          { name, item: canonical },
        ]),
      ],
    } as Seo,
    status: 200,
    data,
  };
}
