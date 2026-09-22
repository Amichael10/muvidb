/**
 * Silverbird website metadata enricher.
 *
 * Scrapes https://silverbirdcinemas.com/amy_movie-sitemap.xml and individual
 * movie pages to harvest high-res backdrops (1920x600), HD posters, NFVCB censor ratings,
 * accurate durations, synopses, and full ensemble cast/directors.
 *
 * Caches the enriched movie catalog in memory for 2 hours so multi-location
 * Veezi adapter runs do not re-scrape the website repeatedly.
 */

export interface SilverbirdEnrichment {
  url: string;
  title: string;
  rating?: string | null;
  runtimeMinutes?: number | null;
  releaseYear?: number | null;
  genres?: string[];
  isNollywood: boolean;
  directors: string[];
  actors: string[];
  posterUrl?: string | null;
  backdropUrl?: string | null;
  synopsis?: string | null;
}

let cachedCatalog: Map<string, SilverbirdEnrichment> | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function cleanStr(s?: string | null): string {
  if (!s) return '';
  return s
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "-")
    .replace(/&#38;/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(the|a|an)\b/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

async function scrapeMoviePage(url: string): Promise<SilverbirdEnrichment | null> {
  if (url.includes('online-ticket')) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Title
    const titleMatch = html.match(/<h1[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ||
                       html.match(/<title>([^<]+)- Silverbird Cinemas<\/title>/i);
    let rawTitle = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    const title = cleanStr(rawTitle.replace(/\(.*?\)/g, ''));
    if (!title) return null;

    // Rating / PG
    const pgMatch = html.match(/<span class=["']pg["']>([\s\S]*?)<\/span>/i);
    let rating: string | null = pgMatch ? cleanStr(pgMatch[1].replace(/<[^>]+>/g, '')) : null;
    if (rating === 'TBC' || (rating && rating.length > 5)) rating = null;

    // Duration
    const durMatch = html.match(/<span class=["']duration["']>([\s\S]*?)<\/span>/i);
    let runtimeMinutes: number | null = null;
    if (durMatch) {
      const durText = durMatch[1].replace(/<[^>]+>/g, '').trim();
      const hrMatch = durText.match(/(\d+)\s*hours?/i);
      const minMatch = durText.match(/(\d+)\s*minutes?/i);
      let mins = 0;
      if (hrMatch) mins += parseInt(hrMatch[1], 10) * 60;
      if (minMatch) mins += parseInt(minMatch[1], 10);
      if (mins > 0) runtimeMinutes = mins;
    }

    // Backdrop: #amy-page-header img (often 1920x600 high-res banner)
    let backdropUrl: string | null = null;
    const headerMatch = html.match(/<section id=["']amy-page-header["'][^>]*>([\s\S]*?)<\/section>/i);
    if (headerMatch) {
      const srcMatch = headerMatch[1].match(/<img[^>]+src=["']([^"']+)["']/i);
      if (srcMatch && !srcMatch[1].includes('default') && !srcMatch[1].includes('logo')) {
        backdropUrl = srcMatch[1];
      }
    }

    // Poster: div.entry-thumb img
    let posterUrl: string | null = null;
    const thumbMatch = html.match(/<div class=["']entry-thumb["']>([\s\S]*?)<\/div>/i);
    if (thumbMatch) {
      const srcMatch = thumbMatch[1].match(/<img[^>]+src=["']([^"']+)["']/i);
      if (srcMatch && !srcMatch[1].includes('default') && !srcMatch[1].includes('logo')) {
        posterUrl = srcMatch[1];
      }
    }

    // Release Date / Year
    let releaseYear: number | null = null;
    const relMatch = html.match(/<li>\s*<label>Release:<\/label>\s*<span>([^<]+)<\/span>/i);
    if (relMatch) {
      const parsedD = new Date(relMatch[1].trim());
      if (!isNaN(parsedD.getTime())) {
        releaseYear = parsedD.getFullYear();
      }
    }

    // Language
    let language = 'English';
    const langMatch = html.match(/<li>\s*<label>Language:<\/label>\s*<span>([^<]+)<\/span>/i);
    if (langMatch) {
      language = cleanStr(langMatch[1]);
    }

    // Genres
    const genreMatches = [...html.matchAll(/<a href=["']https:\/\/silverbirdcinemas\.com\/genre\/[^"']+["'][^>]*>([^<]+)<\/a>/gi)]
      .map(m => cleanStr(m[1]))
      .filter(g => g && !['Now Showing', 'Slider', 'Coming Soon'].includes(g));
    const genres = [...new Set(genreMatches)];

    // Actors
    const actorMatches = [...html.matchAll(/<a href=["']https:\/\/silverbirdcinemas\.com\/actor\/[^"']+["'][^>]*>([^<]+)<\/a>/gi)]
      .map(m => cleanStr(m[1]))
      .filter(Boolean);
    const actors = [...new Set(actorMatches)];

    // Directors
    const dirMatches = [...html.matchAll(/<a href=["']https:\/\/silverbirdcinemas\.com\/director\/[^"']+["'][^>]*>([^<]+)<\/a>/gi)]
      .map(m => cleanStr(m[1]))
      .filter(Boolean);
    const directors = [...new Set(dirMatches)];

    // Synopsis
    let synopsis: string | null = null;
    const synMatch = html.match(/<div[^>]+class=["'][^"']*\bentry-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (synMatch) {
      let rawSyn = synMatch[1];
      rawSyn = rawSyn.replace(/<h3>Synopsis<\/h3>/i, '');
      rawSyn = rawSyn.replace(/SHOWTIME[\s\S]*/i, '');
      rawSyn = rawSyn.replace(/\*NB:[\s\S]*/i, '');
      rawSyn = rawSyn.replace(/<div class=["']entry-showtime[\s\S]*/i, '');
      rawSyn = rawSyn.replace(/<[^>]+>/g, '').trim();
      rawSyn = rawSyn.replace(/^Synopsis\s*/i, '').trim();
      if (rawSyn.length > 20) {
        synopsis = cleanStr(rawSyn);
      }
    }

    const isNollywood = genres.some(g => /nollywood/i.test(g)) ||
                        /yoruba|hausa|igbo/i.test(language) ||
                        /nigeria/i.test(synopsis || '');

    return {
      url,
      title,
      rating,
      runtimeMinutes,
      releaseYear,
      genres,
      isNollywood,
      directors,
      actors,
      posterUrl,
      backdropUrl,
      synopsis,
    };
  } catch {
    return null;
  }
}

export async function getSilverbirdCatalog(): Promise<Map<string, SilverbirdEnrichment>> {
  const now = Date.now();
  if (cachedCatalog && (now - lastFetchTime) < CACHE_TTL_MS) {
    return cachedCatalog;
  }

  const catalog = new Map<string, SilverbirdEnrichment>();

  try {
    const sitemapRes = await fetch('https://silverbirdcinemas.com/amy_movie-sitemap.xml', {
      signal: AbortSignal.timeout(25000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    if (!sitemapRes.ok) return cachedCatalog || catalog;
    const xml = await sitemapRes.text();

    const movieUrls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1])
      .filter(u => u.includes('/movie/') && !u.includes('online-ticket'));

    // Scrape in batches of 5
    for (let i = 0; i < movieUrls.length; i += 5) {
      const batch = movieUrls.slice(i, i + 5);
      const results = await Promise.all(batch.map(url => scrapeMoviePage(url)));
      for (const item of results) {
        if (item && item.title) {
          catalog.set(normalizeTitle(item.title), item);
          // Also set by slug from URL
          const slug = item.url.replace(/^.*\/movie\/([^/]+)\/.*$/, '$1');
          if (slug) catalog.set(normalizeTitle(slug), item);
        }
      }
    }

    cachedCatalog = catalog;
    lastFetchTime = Date.now();
    console.log(`[silverbird-enricher] Loaded ${catalog.size} movies from Silverbird website sitemap.`);
  } catch (err: any) {
    console.warn(`[silverbird-enricher] Failed to load sitemap: ${err.message}`);
  }

  return cachedCatalog || catalog;
}

export async function getSilverbirdEnrichment(title: string): Promise<SilverbirdEnrichment | null> {
  const catalog = await getSilverbirdCatalog();
  if (!catalog.size) return null;

  const key = normalizeTitle(title);
  if (catalog.has(key)) return catalog.get(key)!;

  // Partial or safe variant match
  for (const [normTitle, item] of catalog.entries()) {
    if (key === normTitle) return item;
    if (key.length > 5 && normTitle.length > 5) {
      if (key.includes(normTitle) || normTitle.includes(key)) {
        return item;
      }
    }
  }

  return null;
}
