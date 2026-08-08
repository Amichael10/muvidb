/**
 * africanmoviedb_sync.ts
 *
 * Harvests films and actors from https://africanmoviedb.com
 * Site is server-rendered HTML — no Playwright needed, plain fetch works.
 *
 * URL patterns:
 *   Listing:  /titles/type/movie?page=N   (51 pages, ~10 per page = ~500 films)
 *   Detail:   /title/film-slug-year
 *   People:   /person/person-slug
 *
 * Run: npx tsx scripts/africanmoviedb_sync.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TMDB_KEY = process.env.TMDB_API_KEY!;
const BASE = 'https://africanmoviedb.com';
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml',
};

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

// ─── Simple HTML parser helpers ──────────────────────────────────────────────

/** Extract text content between two markers */
function between(html: string, start: string, end: string): string {
  const s = html.indexOf(start);
  if (s === -1) return '';
  const e = html.indexOf(end, s + start.length);
  return e === -1 ? '' : html.slice(s + start.length, e).trim();
}

/** Get all href matches for a pattern within an HTML string */
function extractLinks(html: string, pattern: string): string[] {
  const re = new RegExp(`href=["'](${pattern}[^"']*)["']`, 'g');
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) found.add(m[1]);
  return Array.from(found);
}

/** Get <meta> og: content */
function getMeta(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
  const m1 = re.exec(html);
  if (m1) return m1[1].trim();
  // Alternate order
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
  const m2 = re2.exec(html);
  return m2 ? m2[1].trim() : '';
}

/** Strip HTML tags */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Decode basic HTML entities */
function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ─── TMDB helpers ─────────────────────────────────────────────────────────────

async function tmdbSearchPerson(name: string): Promise<{ photo_url?: string; biography?: string; tmdb_id?: number } | null> {
  if (!TMDB_KEY) return null;
  try {
    const r = await fetch(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_KEY}&query=${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    const d = await r.json();
    const hit = d.results?.[0];
    if (!hit) return null;
    const det = await (await fetch(`https://api.themoviedb.org/3/person/${hit.id}?api_key=${TMDB_KEY}`)).json();
    return {
      tmdb_id: hit.id,
      photo_url: hit.profile_path ? `https://image.tmdb.org/t/p/w185${hit.profile_path}` : undefined,
      biography: det.biography?.trim().length > 20 ? det.biography.trim() : undefined,
    };
  } catch { return null; }
}

// ─── Person upsert ────────────────────────────────────────────────────────────

async function upsertPerson(name: string, photoUrl?: string): Promise<string | null> {
  const clean = name.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length < 2) return null;
  const low = clean.toLowerCase();
  if (['africanmoviedb', 'unknown', 'actor', 'n/a'].some(b => low.includes(b))) return null;

  // Shared matcher (migration 20260723112408) instead of `ilike('name')`, so
  // order swaps / honorifics resolve to the existing person.
  const { data: foundId } = await supabase.rpc('find_person_by_name', { p_name: clean });
  const { data: existing } = foundId
    ? await supabase.from('people').select('id, photo_url, biography').eq('id', foundId as unknown as string)
    : { data: null as any };
  if (existing && existing.length > 0) {
    const p = existing[0];
    if (!p.photo_url || !p.biography) {
      const tmdb = await tmdbSearchPerson(clean);
      await sleep(120);
      const up: any = {};
      if (!p.photo_url && (photoUrl || tmdb?.photo_url)) up.photo_url = photoUrl || tmdb?.photo_url;
      if (!p.biography && tmdb?.biography) up.biography = tmdb.biography;
      if (tmdb?.tmdb_id) up.tmdb_id = tmdb.tmdb_id;
      if (Object.keys(up).length) await supabase.from('people').update(up).eq('id', p.id);
    }
    return p.id;
  }

  const tmdb = await tmdbSearchPerson(clean);
  await sleep(120);
  const { data: np, error } = await supabase.from('people').insert({
    name: clean,
    photo_url: photoUrl || tmdb?.photo_url || null,
    biography: tmdb?.biography || null,
    tmdb_id: tmdb?.tmdb_id || null,
    source: 'africanmoviedb',
  }).select('id').single();

  if (error) { console.error(`  ❌ Insert person error: ${error.message}`); return null; }
  return np.id;
}

// ─── Parse film detail page ───────────────────────────────────────────────────

interface FilmDetail {
  title: string;
  synopsis: string;
  poster_url: string;
  year: number | null;
  genres: string[];
  countries: string[];
  languages: string[];
  cast: Array<{ name: string; role: string; personUrl: string }>;
  crew: Array<{ name: string; role: string; personUrl: string }>;
}

async function fetchFilmDetail(slug: string): Promise<FilmDetail | null> {
  try {
    const res = await fetch(`${BASE}/title/${slug}`, { headers: HEADERS });
    if (!res.ok) return null;
    const html = await res.text();

    // Title: og:title minus " - African Movie Database"
    const ogTitle = getMeta(html, 'og:title').replace(/\s*[-|]\s*African Movie Database.*$/i, '').trim();
    const title = decodeEntities(ogTitle);
    if (!title) return null;

    // Year: parse from slug (ends with -YYYY)
    const yearMatch = slug.match(/-(\d{4})$/);
    const year = yearMatch ? parseInt(yearMatch[1]) : null;

    // Synopsis: og:description is the clean one
    const synopsis = decodeEntities(getMeta(html, 'og:description'));

    // Poster: og:image
    const poster_url = getMeta(html, 'og:image');

    // Genres: links to /titles/genre/XXX
    const genreLinks = extractLinks(html, '/titles/genre/');
    const genres = genreLinks.map(l => {
      const g = l.split('/titles/genre/')[1]?.split(/[/?#]/)[0] || '';
      return g.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }).filter(Boolean);

    // Countries: links to /titles/country/XXX
    const countryLinks = extractLinks(html, '/titles/country/');
    const countries = countryLinks.map(l => {
      const c = l.split('/titles/country/')[1]?.split(/[/?#]/)[0] || '';
      return c.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }).filter(Boolean);

    // Languages: links to /titles/language/XXX
    const langLinks = extractLinks(html, '/titles/language/');
    const languages = langLinks.map(l => {
      const g = l.split('/titles/language/')[1]?.split(/[/?#]/)[0] || '';
      return g.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }).filter(Boolean);

    // Cast: look for the ### Cast section
    const castSectionMatch = html.match(/###\s*Cast([\s\S]*?)###\s*Crew/i);
    const cast: FilmDetail['cast'] = [];
    if (castSectionMatch) {
      const castHtml = castSectionMatch[1];
      const re = /<a[^>]+href="(\/person\/[^"]+)"[^>]*>([^<]+)<\/a>[^]*?as\s+([^\n<]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(castHtml)) !== null) {
        cast.push({
          personUrl: m[1],
          name: decodeEntities(m[2].trim()),
          role: decodeEntities(m[3].trim()),
        });
      }
    }
    // Fallback: find any /person/ links near "as" text
    if (cast.length === 0) {
      const personRe = /href=["'](\/person\/[^"']+)["'][^>]*>([^<]+)<\/a>[^]*?as\s+([^\n<]{2,50})/gi;
      let m: RegExpExecArray | null;
      while ((m = personRe.exec(html)) !== null) {
        const n = decodeEntities(m[2].trim());
        if (n.length > 1 && !n.toLowerCase().includes('african')) {
          cast.push({ personUrl: m[1], name: n, role: decodeEntities(m[3].trim()) });
        }
      }
    }

    // Crew: look for ### Crew section
    const crewSectionMatch = html.match(/###\s*Crew([\s\S]*?)##\s/i);
    const crew: FilmDetail['crew'] = [];
    if (crewSectionMatch) {
      const crewHtml = crewSectionMatch[1];
      const re = /href=["'](\/person\/[^"']+)["'][^>]*>([^<]+)<\/a>[^]*?As\s+([^\n<]+)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(crewHtml)) !== null) {
        crew.push({
          personUrl: m[1],
          name: decodeEntities(m[2].trim()),
          role: decodeEntities(m[3].trim()),
        });
      }
    }

    return { title, synopsis, poster_url, year, genres, countries, languages, cast, crew };
  } catch (e: any) {
    console.error(`  ❌ Detail fetch error for ${slug}:`, e.message);
    return null;
  }
}

// ─── Main harvest loop ────────────────────────────────────────────────────────

async function main() {
  console.log('🌍 Starting AfricanMovieDB Sync...\n');

  // Collect all film slugs from paginated listing
  // The listing URL is /titles/type/movie?page=N, last page is 51
  const allSlugs = new Set<string>();

  // Scrape by country + the main movies listing (51 pages)
  const listingUrls = [
    '/titles/type/movie',   // ~51 pages = ~500+ films
    '/titles/country/nigeria',
    '/titles/country/ghana',
    '/titles/country/kenya',
    '/titles/country/south-africa',
    '/titles/country/ethiopia',
    '/titles/country/cameroon',
    '/titles/country/senegal',
  ];

  for (const baseUrl of listingUrls) {
    console.log(`📋 Discovering titles from ${baseUrl}...`);
    let page = 1;
    while (true) {
      const url = `${BASE}${baseUrl}?page=${page}`;
      try {
        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) break;
        const html = await res.text();

        const links = extractLinks(html, '/title/');
        const newLinks = links.filter(l => !l.includes('#') && !l.includes('?'));
        if (newLinks.length === 0) break;

        newLinks.forEach(l => allSlugs.add(l.replace('/title/', '')));

        // Parse the last page number from the paginator
        // Matches: href="...?page=51">Last  OR  href="...page=51">51
        const lastMatch = html.match(/href=["'][^"']+[?&]page=(\d+)["'][^>]*>(?:Last|\u00bb)/i);
        const allPageNums = [...html.matchAll(/[?&]page=(\d+)/g)].map(m => parseInt(m[1]));
        const totalPages = lastMatch ? parseInt(lastMatch[1]) : (allPageNums.length ? Math.max(...allPageNums) : 1);

        process.stdout.write(`\r  Page ${page}/${totalPages} — ${allSlugs.size} unique titles found`);

        if (page >= totalPages) break;
        page++;
        await sleep(600);
      } catch (e) {
        break;
      }
    }
    console.log();
  }

  console.log(`\n✅ Discovered ${allSlugs.size} unique film slugs\n`);
  console.log('🔍 Fetching film details and upserting to Supabase...\n');

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const slugList = Array.from(allSlugs);

  for (let i = 0; i < slugList.length; i++) {
    const slug = slugList[i];
    const detail = await fetchFilmDetail(slug);
    await sleep(400);

    if (!detail || !detail.title) { skipped++; continue; }

    // Check if film already exists
    let { data: existing } = await supabase
      .from('films')
      .select('id, synopsis, poster_url, streaming_links')
      .ilike('title', detail.title);

    // Narrow by year if multiple matches
    if (existing && existing.length > 1 && detail.year) {
      const { data: yearMatch } = await supabase
        .from('films')
        .select('id, synopsis, poster_url, streaming_links')
        .ilike('title', detail.title)
        .eq('year', detail.year);
      if (yearMatch && yearMatch.length > 0) existing = yearMatch;
    }

    const filmUrl = `${BASE}/title/${slug}`;
    const streamingLinks = { africanmoviedb: filmUrl };

    if (existing && existing.length > 0) {
      const film = existing[0];
      const up: any = {
        streaming_links: { ...(film.streaming_links || {}), ...streamingLinks },
      };
      if (!film.synopsis && detail.synopsis) up.synopsis = detail.synopsis;
      if (!film.poster_url && detail.poster_url) up.poster_url = detail.poster_url;
      if (detail.countries.length) up.countries = detail.countries;

      await supabase.from('films').update(up).eq('id', film.id);

      // Upsert cast/crew for existing film
      await upsertCredits(film.id, detail);
      updated++;
    } else {
      // Insert new film
      const { data: newFilm, error } = await supabase.from('films').insert({
        title: detail.title,
        synopsis: detail.synopsis || null,
        poster_url: detail.poster_url || null,
        backdrop_url: detail.poster_url || null,
        year: detail.year,
        countries: detail.countries.length ? detail.countries : ['Nigeria'],
        source: 'africanmoviedb',
        source_video_id: `africanmoviedb-${slug}`,
        streaming_links: streamingLinks,
        status: 'released',
        needs_review: !detail.synopsis,
        release_type: 'cinema',
      }).select('id').single();

      if (error) {
        console.error(`  ❌ Insert error for ${detail.title}:`, error.message);
        errors++;
        continue;
      }
      console.log(`  ✨ New: ${detail.title} (${detail.year || '?'})`);
      await upsertCredits(newFilm.id, detail);
      inserted++;
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${slugList.length} — ✨ ${inserted} new, 🔄 ${updated} updated, ⏭ ${skipped} skipped`);
    }
  }

  console.log('\n\n=== AfricanMovieDB Sync Complete ===');
  console.log(`  ✨ New films:     ${inserted}`);
  console.log(`  🔄 Updated:       ${updated}`);
  console.log(`  ⏭ Skipped:       ${skipped}`);
  console.log(`  ❌ Errors:        ${errors}`);
}

async function upsertCredits(filmId: string, detail: FilmDetail) {
  for (const person of detail.cast) {
    if (!person.name || person.name.length < 2) continue;
    const personId = await upsertPerson(person.name);
    if (personId) {
      await supabase.from('credits').upsert({
        film_id: filmId,
        person_id: personId,
        role: 'actor',
        character_name: person.role || null,
      }, { onConflict: 'film_id,person_id,role' });
    }
  }
  for (const person of detail.crew) {
    if (!person.name || person.name.length < 2) continue;
    const personId = await upsertPerson(person.name);
    if (personId) {
      const role = person.role.toLowerCase().includes('director') ? 'director'
        : person.role.toLowerCase().includes('producer') ? 'producer'
        : 'crew';
      await supabase.from('credits').upsert({
        film_id: filmId,
        person_id: personId,
        role,
        character_name: person.role || null,
      }, { onConflict: 'film_id,person_id,role' });
    }
  }
}

main().catch(console.error);
