/**
 * Firecrawl-backed IMDb Africa enrich sync.
 * Playwright often gets empty/blocked IMDb search pages; Firecrawl works.
 *
 *   npx tsx scripts/imdb_bulk_sync.ts --dry-run --max-films 10
 *   npx tsx scripts/imdb_bulk_sync.ts --max-films 150 --countries ng,gh,za,ke
 *   npx tsx scripts/imdb_bulk_sync.ts --resume
 *   npx tsx scripts/imdb_bulk_sync.ts --ids tt0490011 --full-credits
 *
 * Batch-enrich OUR thin films (preferred for catalog backfill):
 *   npx tsx scripts/imdb_bulk_sync.ts --from-db --full-credits --skip-people-pages --max-films 50
 *   npx tsx scripts/imdb_bulk_sync.ts --from-db --max-credits 8 --max-films 100 --resume
 *
 * Official aggregate rating only — never scrapes IMDb user review text (IP).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as cheerio from 'cheerio';
import { supabase } from './lib/db';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'scratch', 'imdb');
const CHECKPOINT = path.join(OUT_DIR, 'checkpoint.json');
const REPORT = path.join(OUT_DIR, 'sync-report.json');

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
  process.env.FIRECRAWL_API_KEY_4,
  process.env.FIRECRAWL_API_KEY_5,
].filter(Boolean) as string[];

const DEFAULT_COUNTRIES = [
  'ng', 'gh', 'za', 'ke', 'eg', 'ma', 'sn', 'ci', 'cm', 'ug',
  'tz', 'et', 'rw', 'zw', 'bw', 'ao', 'cd', 'tn', 'dz', 'na',
];

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const RESUME = args.includes('--resume');
const FROM_DB = args.includes('--from-db');
const FULL_CREDITS = args.includes('--full-credits') || args.includes('--ids') || FROM_DB;
const MAX_FILMS = Number(args[args.indexOf('--max-films') + 1]) || 200;
const MAX_SEARCH_PAGES = Number(args[args.indexOf('--max-pages') + 1]) || 6;
/** Films with fewer than this many credits are candidates for --from-db. */
const MAX_CREDITS = Number(args[args.indexOf('--max-credits') + 1]) || 8;
const ENRICH_PEOPLE = !args.includes('--skip-people-pages');
const ID_LIST = args.includes('--ids')
  ? String(args[args.indexOf('--ids') + 1] || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^tt\d+$/i.test(s))
      .map((s) => s.toLowerCase())
  : [];
const countriesArg = args.includes('--countries')
  ? String(args[args.indexOf('--countries') + 1] || '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
  : DEFAULT_COUNTRIES;

type DbFilmTarget = {
  id: string;
  title: string;
  year: number | null;
  imdb_id: string | null;
  creditCount: number;
};

type QueueItem = {
  title: string;
  url: string;
  /** When set, always write onto this film row (don't fuzzy-create/match elsewhere). */
  forceFilmId?: string;
};

type CreditRow = {
  name: string;
  role: string;
  character: string | null;
  img: string | null;
  imdbUrl: string | null;
};

type FilmMeta = {
  imdbId: string | null;
  title: string | null;
  year: number | null;
  runtimeMinutes: number | null;
  synopsis: string | null;
  posterUrl: string | null;
  genres: string[];
  /** IMDb aggregate rating 0–10 (official score only — no user review text). */
  rating: number | null;
  voteCount: number | null;
  cast: Array<{ name: string; character: string | null; img: string | null; imdbUrl: string | null }>;
  directors: Array<{ name: string; imdbUrl: string | null }>;
  /** Extra crew from /fullcredits/ (producers, designers, etc.) */
  crew: CreditRow[];
};

type Checkpoint = {
  doneFilmUrls: string[];
  doneFilmIds: string[];
  stats: Record<string, number>;
};

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function makeSlug(text: string) {
  return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'untitled';
}

async function uniqueSlug(table: 'people' | 'films', base: string) {
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${i + 2}`.slice(0, 80);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 80);
}

function textLen(s: string | null | undefined) {
  return (s || '').trim().length;
}

function isJunkSynopsis(s: string | null | undefined) {
  const t = (s || '').toLowerCase();
  if (!t) return true;
  return (
    (t.includes('cookies') && t.includes('privacy'))
    || t.includes('we use different types of cookies')
    || t.includes('optimize your experience on our website')
  );
}

function upgradeImdbImage(url: string | null) {
  if (!url) return null;
  return url.replace(/\._V1_[^.]+\./, '._V1_SX600.');
}

function filmRichness(f: any) {
  let s = 0;
  const syn = isJunkSynopsis(f.synopsis) ? '' : f.synopsis;
  s += Math.min(40, Math.floor(textLen(syn) / 20));
  if (f.poster_url) s += 15;
  if (f.backdrop_url) s += 8;
  if (f.year) s += 5;
  if (f.runtime_minutes) s += 5;
  if (f.genres?.length) s += Math.min(10, f.genres.length * 2);
  return s;
}

function personRichness(p: any) {
  let s = 0;
  s += Math.min(40, Math.floor(textLen(p.bio) / 25));
  if (p.photo_url) s += 20;
  if (p.date_of_birth) s += 10;
  if (p.birthplace) s += 5;
  if (p.nationality) s += 5;
  return s;
}

let fcIdx = 0;
async function firecrawlScrape(url: string): Promise<{ markdown: string; links: string[]; html: string }> {
  if (!FIRECRAWL_KEYS.length) throw new Error('FIRECRAWL_API_KEY missing');

  let lastErr = '';
  for (let attempt = 0; attempt < FIRECRAWL_KEYS.length * 2; attempt++) {
    const key = FIRECRAWL_KEYS[fcIdx % FIRECRAWL_KEYS.length];
    fcIdx++;
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'links', 'html'],
        waitFor: 2500,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      return {
        markdown: data.data?.markdown || '',
        links: data.data?.links || [],
        html: data.data?.html || '',
      };
    }
    lastErr = data.error || `HTTP ${res.status}`;
    if (res.status === 402 || res.status === 429 || res.status === 401) continue;
    break;
  }
  throw new Error(`Firecrawl failed for ${url}: ${lastErr}`);
}

function extractTitleLinks(links: string[], markdown: string) {
  const ids = new Map<string, { title: string; url: string }>();

  for (const link of links) {
    const m = link.match(/^(https?:\/\/www\.imdb\.com\/title\/(tt\d+))/i);
    if (!m) continue;
    const id = m[2];
    if (ids.has(id)) continue;
    ids.set(id, { title: id, url: `https://www.imdb.com/title/${id}/` });
  }

  // Prefer titles from markdown anchors: [Title](https://www.imdb.com/title/tt.../)
  const re = /\[([^\]]+)\]\((https?:\/\/www\.imdb\.com\/title\/(tt\d+)[^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown))) {
    let title = match[1]
      .replace(/\*\*/g, '')
      .replace(/\\/g, '')
      .replace(/^\d+\.\s*/, '')
      .trim();
    const id = match[3];
    if (!title || title.length < 2) continue;
    if (/^tt\d+$/i.test(title)) continue;
    ids.set(id, { title, url: `https://www.imdb.com/title/${id}/` });
  }

  return [...ids.values()];
}

function parseFilmFromHtml(html: string, fallbackTitle: string): FilmMeta {
  const $ = cheerio.load(html || '');

  const title =
    ($('h1[data-testid="hero__pageTitle"]').text().trim()
      || $('h1').first().text().trim()
      || fallbackTitle)
      .replace(/\*\*/g, '')
      .replace(/\\/g, '')
      .replace(/^\d+\.\s*/, '')
      .trim();

  let year: number | null = null;
  const yearText = $('a[href*="/releaseinfo"]').first().text().trim();
  const y = parseInt(yearText, 10);
  if (y > 1880 && y < 2100) year = y;

  let runtimeMinutes: number | null = null;
  $('li.ipc-inline-list__item').each((_, el) => {
    const t = $(el).text().trim();
    if (!/\d+\s*[hm]/.test(t)) return;
    let h = 0;
    let m = 0;
    const hm = t.match(/(\d+)\s*h/);
    const mm = t.match(/(\d+)\s*m/);
    if (hm) h = parseInt(hm[1], 10);
    if (mm) m = parseInt(mm[1], 10);
    if (h || m) runtimeMinutes = h * 60 + m;
  });

  const synopsis =
    $('[data-testid="plot-xl"]').text().trim()
    || $('[data-testid="plot-l"]').text().trim()
    || $('[data-testid="plot-xs_to_m"]').text().trim()
    || null;

  const posterUrl =
    $('[data-testid="hero-media__poster"] img.ipc-image').attr('src')
    || $('img.ipc-image').first().attr('src')
    || null;

  const genres: string[] = [];
  $('.ipc-chip-list__scroller a.ipc-chip').each((_, el) => {
    const g = $(el).text().trim();
    if (g) genres.push(g);
  });

  const cast: FilmMeta['cast'] = [];
  $('[data-testid="title-cast-item"]').each((_, el) => {
    const name = $(el).find('[data-testid="title-cast-item__actor"]').text().trim();
    const href = $(el).find('[data-testid="title-cast-item__actor"]').attr('href') || null;
    const character = $(el).find('[data-testid="cast-item-characters-link"]').text().trim() || null;
    const img = $(el).find('img.ipc-image').attr('src') || null;
    if (name) {
      cast.push({
        name,
        character,
        img,
        imdbUrl: href ? (href.startsWith('http') ? href : `https://www.imdb.com${href}`) : null,
      });
    }
  });

  const directors: FilmMeta['directors'] = [];
  $('[data-testid="title-pc-principal-credit"], li.ipc-metadata-list__item').each((_, el) => {
    const label = $(el).text().toLowerCase();
    if (!label.includes('director')) return;
    $(el).find('a').each((__, a) => {
      const name = $(a).text().trim();
      if (!name || /^directors?$/i.test(name)) return;
      const href = $(a).attr('href') || null;
      if (!directors.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
        directors.push({
          name,
          imdbUrl: href ? (href.startsWith('http') ? href : `https://www.imdb.com${href}`) : null,
        });
      }
    });
  });

  const imdbId = (html.match(/\/title\/(tt\d+)/) || [])[1] || null;

  // Official aggregate score only — never scrape user review bodies (IP).
  let rating: number | null = null;
  let voteCount: number | null = null;
  const ldBlocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of ldBlocks) {
    const raw = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const json = JSON.parse(raw);
      const nodes = Array.isArray(json) ? json : [json];
      for (const node of nodes) {
        const agg = node?.aggregateRating;
        if (!agg) continue;
        const v = Number(agg.ratingValue);
        const c = Number(agg.ratingCount ?? agg.reviewCount);
        if (Number.isFinite(v) && v > 0 && v <= 10) rating = Math.round(v * 10) / 10;
        if (Number.isFinite(c) && c > 0) voteCount = Math.round(c);
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  if (rating == null) {
    const scoreText =
      $('[data-testid="hero-rating-bar__aggregate-rating__score"] span').first().text().trim()
      || $('[data-testid="hero-rating-bar__aggregate-rating__score"]').first().text().trim();
    const v = parseFloat(scoreText);
    if (Number.isFinite(v) && v > 0 && v <= 10) rating = Math.round(v * 10) / 10;
  }
  if (voteCount == null) {
    const voteText =
      $('[data-testid="hero-rating-bar__aggregate-rating"]').text()
      || $('[data-testid="hero-rating-bar__aggregate-rating__score"]').parent().text();
    const m = voteText.match(/([\d.,]+)\s*([kKmM])?\s*(?:User ratings|ratings)?/i)
      || html.match(/"ratingCount"\s*:\s*(\d+)/i);
    if (m) {
      let n = parseFloat(String(m[1]).replace(/,/g, ''));
      const unit = (m[2] || '').toLowerCase();
      if (unit === 'k') n *= 1000;
      if (unit === 'm') n *= 1_000_000;
      if (Number.isFinite(n) && n > 0) voteCount = Math.round(n);
    }
  }

  return {
    imdbId,
    title: title || fallbackTitle,
    year,
    runtimeMinutes,
    synopsis: synopsis && !isJunkSynopsis(synopsis) ? synopsis : null,
    posterUrl,
    genres,
    rating,
    voteCount,
    cast,
    directors,
    crew: [],
  };
}

/** Map IMDb fullcredits section headers → our credit roles. */
function mapCreditsSection(header: string): string | null {
  const h = header.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!h || h === 'edit' || h === 'see more' || h.length > 60) return null;
  if (/^direct(ed|or|ion)\b/.test(h)) return 'director';
  if (/^writ(ing|er|ten)\b/.test(h) || h.includes('screenplay') || /^story by\b/.test(h)) return 'writer';
  if (/^cast$/.test(h) || h === 'cast in credits order' || /^cast\b/.test(h)) return 'actor';
  if (/^produc/.test(h)) return 'producer';
  if (h.includes('cinematograph') || h.includes('director of photography')) return 'cinematographer';
  if (h.includes('production design') || /^art direction\b/.test(h) || /^art director\b/.test(h)) return 'art director';
  if (/^edit(or|ing|ed by)\b/.test(h) || h === 'film editing') return 'editor';
  if (/^music\b/.test(h) || h.includes('composer') || h.includes('soundtrack')) return 'composer';
  if (/^sound\b/.test(h)) return 'sound';
  if (h.includes('costume')) return 'costume designer';
  if (h.includes('makeup') || h.includes('make up')) return 'makeup';
  return null;
}

function parseFullCredits(html: string, markdown: string): { cast: FilmMeta['cast']; directors: FilmMeta['directors']; crew: CreditRow[] } {
  const cast: FilmMeta['cast'] = [];
  const directors: FilmMeta['directors'] = [];
  const crew: CreditRow[] = [];
  const seen = new Set<string>();

  const push = (name: string, role: string, character: string | null, href: string | null) => {
    const n = name.replace(/\s+/g, ' ').trim();
    if (!n || n.length < 2) return;
    if (/^(edit|see agents|imdbpro|contribute|jump to|related lists|go to|back to|more from|more to explore)/i.test(n)) return;
    if (/^go to\b/i.test(n)) return;
    if (!/[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(n)) return;
    const key = `${role}|${n.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const imdbUrl = href
      ? (href.startsWith('http') ? href.split('?')[0] : `https://www.imdb.com${href.split('?')[0]}`)
      : null;
    if (role === 'director') {
      directors.push({ name: n, imdbUrl });
    } else if (role === 'actor') {
      cast.push({ name: n, character, img: null, imdbUrl });
    } else {
      crew.push({ name: n, role, character: null, img: null, imdbUrl });
    }
  };

  // Prefer classic fullcredits tables in HTML
  const $ = cheerio.load(html || '');
  let currentRole: string | null = null;
  $('h4, h3, .ipc-title__text, table').each((_, el) => {
    const tag = ((el as any).tagName || (el as any).name || '').toLowerCase();
    if (tag === 'h4' || tag === 'h3' || $(el).hasClass('ipc-title__text')) {
      const mapped = mapCreditsSection($(el).text());
      if (mapped) currentRole = mapped;
      return;
    }
    if (tag !== 'table' || !currentRole) return;
    $(el).find('tr').each((__, tr) => {
      const a = $(tr).find('a[href*="/name/nm"]').first();
      const name = a.text().trim();
      if (!name) return;
      const href = a.attr('href') || null;
      let character: string | null = null;
      if (currentRole === 'actor') {
        character = $(tr).find('.character a, td.character').text().replace(/\s+/g, ' ').trim() || null;
        if (character) character = character.replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || null;
      }
      push(name, currentRole!, character, href);
    });
  });

  // Markdown fallback (Firecrawl often returns clean section headers)
  if (!cast.length && !directors.length) {
    const lines = (markdown || '').split(/\n/);
    let role: string | null = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const header = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      const mapped = mapCreditsSection(header);
      if (mapped && line.length < 80) {
        role = mapped;
        continue;
      }
      if (!role) continue;
      const link = line.match(/\[([^\]]+)\]\((https?:\/\/www\.imdb\.com\/name\/nm\d+[^)]*)\)/i)
        || line.match(/\[([^\]]+)\]\((\/name\/nm\d+[^)]*)\)/i);
      if (link) {
        let character: string | null = null;
        if (role === 'actor') {
          const asMatch = line.match(/\(as\s+([^)]+)\)/i);
          character = asMatch?.[1]?.trim() || null;
        }
        push(link[1], role, character, link[2]);
        continue;
      }
      // Plain name line under a section (no link)
      if (/^[A-ZÀ-ÖØ-öø-ÿ][\w.'’\- ]{1,60}$/.test(line) && !/^edit$/i.test(line)) {
        push(line, role, null, null);
      }
    }
  }

  return { cast, directors, crew };
}

function mergeFullCredits(meta: FilmMeta, extra: ReturnType<typeof parseFullCredits>): FilmMeta {
  const castNames = new Set(meta.cast.map((c) => c.name.toLowerCase()));
  for (const c of extra.cast) {
    if (!castNames.has(c.name.toLowerCase())) {
      meta.cast.push(c);
      castNames.add(c.name.toLowerCase());
    } else {
      const existing = meta.cast.find((x) => x.name.toLowerCase() === c.name.toLowerCase());
      if (existing && !existing.character && c.character) existing.character = c.character;
      if (existing && !existing.imdbUrl && c.imdbUrl) existing.imdbUrl = c.imdbUrl;
    }
  }
  const dirNames = new Set(meta.directors.map((d) => d.name.toLowerCase()));
  for (const d of extra.directors) {
    if (!dirNames.has(d.name.toLowerCase())) meta.directors.push(d);
  }
  meta.crew = extra.crew;
  return meta;
}

function parsePersonFromHtml(html: string, fallbackName: string) {
  const $ = cheerio.load(html || '');
  const name =
    $('h1[data-testid="hero__pageTitle"]').text().trim()
    || $('h1').first().text().trim()
    || fallbackName;

  const bio = $('.ipc-html-content-inner-div').first().text().trim() || null;
  const photoUrl =
    $('[data-testid="hero-media__poster"] img.ipc-image').attr('src')
    || $('img.ipc-image').first().attr('src')
    || null;

  let dateOfBirth: string | null = null;
  let birthplace: string | null = null;
  const bornText = $('[data-testid="birth-and-death-birthdate"]').text().replace(/\s+/g, ' ').trim()
    || $('li:contains("Born")').first().text().replace(/\s+/g, ' ').trim();

  const months: Record<string, string> = {
    January: '01', February: '02', March: '03', April: '04', May: '05', June: '06',
    July: '07', August: '08', September: '09', October: '10', November: '11', December: '12',
  };
  const ymd = bornText.match(/([A-Z][a-z]+)\s+(\d{1,2}),\s+(\d{4})/);
  if (ymd && months[ymd[1]]) {
    dateOfBirth = `${ymd[3]}-${months[ymd[1]]}-${ymd[2].padStart(2, '0')}`;
  } else {
    const md = bornText.match(/([A-Z][a-z]+)\s+(\d{1,2})(?!,?\s*\d{4})/);
    if (md && months[md[1]]) dateOfBirth = `0001-${months[md[1]]}-${md[2].padStart(2, '0')}`;
  }
  const place = bornText.match(/\bin\s+(.+)$/i);
  if (place) birthplace = place[1].trim();

  return { name, bio, photoUrl, dateOfBirth, birthplace };
}

async function matchFilm(title: string, year: number | null = null, imdbId: string | null = null) {
  if (imdbId) {
    const { data: byId } = await supabase
      .from('films')
      .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source,imdb_id,imdb_rating,imdb_vote_count,tmdb_rating')
      .eq('imdb_id', imdbId)
      .maybeSingle();
    if (byId) return byId;
  }

  const { data: exactRows } = await supabase
    .from('films')
    .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source,imdb_id,imdb_rating,imdb_vote_count,tmdb_rating')
    .ilike('title', title)
    .limit(10);
  if (exactRows?.length) {
    if (year) {
      const sameYear = exactRows.filter((r) => r.year === year);
      if (sameYear.length) return [...sameYear].sort((a, b) => filmRichness(b) - filmRichness(a))[0];
    }
    return [...exactRows].sort((a, b) => filmRichness(b) - filmRichness(a))[0];
  }

  // Avoid fuzzy-matching "Title" onto "Title 2" / "Title 3"
  if (year) {
    const { data: yearRows } = await supabase
      .from('films')
      .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source,imdb_id,imdb_rating,imdb_vote_count,tmdb_rating')
      .eq('year', year)
      .ilike('title', `${title}%`)
      .limit(10);
    const exactish = (yearRows || []).filter((r) => {
      const a = (r.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
      const b = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
      return a === b;
    });
    if (exactish.length) return exactish[0];
  }

  const { data } = await supabase.rpc('match_film_fuzzy', { query_title: title, threshold: 0.65 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  const { data: film } = await supabase
    .from('films')
    .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source,imdb_id,imdb_rating,imdb_vote_count,tmdb_rating')
    .eq('id', row.id)
    .maybeSingle();
  if (film && year && film.year && film.year !== year) {
    // Fuzzy hit on a sequel/different year — treat as no match so we create the right title
    const a = (film.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const b = title.toLowerCase().replace(/[^a-z0-9]+/g, '');
    if (a !== b) return null;
  }
  return film;
}

async function matchPerson(name: string) {
  const { data: exact } = await supabase
    .from('people')
    .select('id,name,bio,photo_url,date_of_birth,birthplace,nationality,source')
    .ilike('name', name)
    .limit(5);
  if (exact?.length) {
    return [...exact].sort((a, b) => personRichness(b) - personRichness(a))[0];
  }

  const { data } = await supabase.rpc('match_person_fuzzy', { query_name: name, threshold: 0.7 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  const { data: person } = await supabase
    .from('people')
    .select('id,name,bio,photo_url,date_of_birth,birthplace,nationality,source')
    .eq('id', row.id)
    .maybeSingle();
  return person;
}

function filmPatch(existing: any, imdb: FilmMeta) {
  const patch: Record<string, any> = {};
  const ours = filmRichness(existing);
  const theirs = filmRichness({
    synopsis: imdb.synopsis,
    poster_url: imdb.posterUrl,
    year: imdb.year,
    runtime_minutes: imdb.runtimeMinutes,
    genres: imdb.genres,
  });

  // Always keep IMDb identity + official score (not review text).
  if (imdb.imdbId && existing.imdb_id !== imdb.imdbId) patch.imdb_id = imdb.imdbId;
  if (imdb.rating != null && existing.imdb_rating !== imdb.rating) patch.imdb_rating = imdb.rating;
  if (imdb.voteCount != null && existing.imdb_vote_count !== imdb.voteCount) patch.imdb_vote_count = imdb.voteCount;

  if (ours >= theirs + 10 && !isJunkSynopsis(existing.synopsis) && textLen(existing.synopsis) >= 120 && existing.poster_url) {
    return { patch, skip: true };
  }

  if (
    (isJunkSynopsis(existing.synopsis) || textLen(existing.synopsis) < 80)
    && textLen(imdb.synopsis) > 40
  ) {
    patch.synopsis = imdb.synopsis;
  } else if (imdb.synopsis && textLen(imdb.synopsis) > textLen(isJunkSynopsis(existing.synopsis) ? '' : existing.synopsis) + 80) {
    patch.synopsis = imdb.synopsis;
  }

  if (!existing.poster_url && imdb.posterUrl) patch.poster_url = upgradeImdbImage(imdb.posterUrl);
  if (!existing.year && imdb.year) patch.year = imdb.year;
  if (!existing.runtime_minutes && imdb.runtimeMinutes) patch.runtime_minutes = imdb.runtimeMinutes;
  if ((!existing.genres || !existing.genres.length) && imdb.genres.length) patch.genres = imdb.genres;
  return { patch, skip: false };
}

function personPatch(existing: any, imdb: ReturnType<typeof parsePersonFromHtml>) {
  const patch: Record<string, any> = {};
  if ((!existing.bio || textLen(existing.bio) < 60) && textLen(imdb.bio) > textLen(existing.bio)) patch.bio = imdb.bio;
  else if (imdb.bio && textLen(imdb.bio) > textLen(existing.bio) + 60) patch.bio = imdb.bio;
  if (!existing.photo_url && imdb.photoUrl) patch.photo_url = upgradeImdbImage(imdb.photoUrl);
  if (!existing.date_of_birth && imdb.dateOfBirth) patch.date_of_birth = imdb.dateOfBirth;
  if (!existing.birthplace && imdb.birthplace) patch.birthplace = imdb.birthplace;
  return patch;
}

function loadCheckpoint(): Checkpoint {
  if (RESUME && fs.existsSync(CHECKPOINT)) {
    const raw = JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
    return {
      doneFilmUrls: raw.doneFilmUrls || [],
      doneFilmIds: raw.doneFilmIds || [],
      stats: raw.stats || {
        filmsCreated: 0,
        filmsEnriched: 0,
        filmsSkippedRich: 0,
        peopleCreated: 0,
        peopleEnriched: 0,
        creditsLinked: 0,
        filmsUnmatched: 0,
        errors: 0,
      },
    };
  }
  return {
    doneFilmUrls: [],
    doneFilmIds: [],
    stats: {
      filmsCreated: 0,
      filmsEnriched: 0,
      filmsSkippedRich: 0,
      peopleCreated: 0,
      peopleEnriched: 0,
      creditsLinked: 0,
      filmsUnmatched: 0,
      errors: 0,
    },
  };
}

function saveCheckpoint(cp: Checkpoint) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(CHECKPOINT, JSON.stringify(cp, null, 2));
}

async function collectFilmLinks(countries: string[], maxPages: number) {
  const all = new Map<string, { title: string; url: string }>();

  for (const country of countries) {
    for (let page = 1; page <= maxPages; page++) {
      const start = (page - 1) * 50 + 1;
      const url =
        `https://www.imdb.com/search/title/?countries=${country}`
        + `&title_type=feature,tv_movie,video&sort=num_votes,desc&start=${start}`;
      console.log(`🔎 ${country} page ${page}: ${url}`);
      try {
        const scraped = await firecrawlScrape(url);
        const found = extractTitleLinks(scraped.links, scraped.markdown);
        let added = 0;
        for (const f of found) {
          const id = (f.url.match(/tt\d+/) || [])[0];
          if (!id || all.has(id)) continue;
          all.set(id, f);
          added++;
        }
        console.log(`   +${added} (unique ${all.size})`);
        if (added === 0) break;
        await delay(800);
      } catch (e: any) {
        console.warn(`   search fail: ${e.message}`);
        break;
      }
    }
  }
  return [...all.values()];
}

function normTitle(s: string) {
  return (s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isJunkImdbCandidateTitle(title: string) {
  const t = title.toLowerCase();
  if (
    /\b(trailer|teaser|behind the scenes|bts|interview|premiere night|showing next|watch online|full movie|official video|just released|super interesting|mafia boss|stopped smiling)\b/.test(t)
  ) return true;
  if (/\b(part|episode|ep)\.?\s*\d+\b/.test(t)) return true;
  if (/\bon\s+(youtube|netflix|amazon|apatatv|ibakatv|rokstudios)\+?\b/.test(t)) return true;
  if (title.length > 80) return true;
  if (title.split(/\s+/).filter(Boolean).length >= 10) return true;
  return false;
}

/** Find published films with thin cast/crew for batch enrichment. */
async function collectThinFilmsFromDb(limit: number, maxCredits: number, doneIds: Set<string>): Promise<DbFilmTarget[]> {
  const pageSize = 500;
  const candidates: Array<DbFilmTarget & { score: number }> = [];
  let from = 0;
  const goodSources = new Set([
    'nollymeter', 'nollydata', 'tmdb', 'mubi', 'netflix', 'imdb', 'manual', 'amaa', 'amvca', 'tinff',
  ]);

  while (candidates.length < limit * 4) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id,title,year,imdb_id,synopsis,poster_url,is_published,status,source')
      .eq('is_published', true)
      .lte('year', 2024)
      .gte('year', 1985)
      .order('year', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!films?.length) break;

    const ids = films.map((f) => f.id).filter((id) => !doneIds.has(id));
    const counts = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 200) {
      const slice = ids.slice(i, i + 200);
      const { data: creds } = await supabase.from('credits').select('film_id').in('film_id', slice);
      for (const c of creds || []) {
        counts.set(c.film_id, (counts.get(c.film_id) || 0) + 1);
      }
    }

    for (const f of films) {
      if (doneIds.has(f.id)) continue;
      const n = counts.get(f.id) || 0;
      if (n >= maxCredits) continue;
      const title = (f.title || '').trim();
      if (title.length < 2) continue;
      if (isJunkImdbCandidateTitle(title)) continue;
      if (!f.imdb_id && !f.year) continue;
      // Most brand-new YouTube-year rows aren't on IMDb with usable credits yet.
      if (!f.imdb_id && f.year && f.year >= 2026) continue;

      let score = 0;
      if (f.imdb_id) score += 1000;
      if (f.year && f.year <= 2025) score += 80;
      if (f.year && f.year >= 1990 && f.year <= 2024) score += 40;
      if (goodSources.has(String(f.source || '').toLowerCase())) score += 60;
      if (textLen(f.synopsis) > 60) score += 40;
      if (f.poster_url) score += 20;
      // Partial cast already → more likely a real title worth completing
      if (n >= 1 && n < maxCredits) score += 50;
      score -= n; // thinner first among peers

      candidates.push({
        id: f.id,
        title,
        year: f.year,
        imdb_id: f.imdb_id,
        creditCount: n,
        score,
      });
    }

    from += pageSize;
    if (films.length < pageSize) break;
  }

  candidates.sort((a, b) => b.score - a.score || (b.year || 0) - (a.year || 0));
  return candidates.slice(0, limit).map(({ score: _s, ...rest }) => rest);
}

/** Resolve title(+year) → IMDb tt id via find page. */
async function findImdbTitle(title: string, year: number | null): Promise<{ id: string; url: string } | null> {
  const q = year ? `${title} ${year}` : title;
  const url = `https://www.imdb.com/find/?q=${encodeURIComponent(q)}&s=tt`;
  const scraped = await firecrawlScrape(url);
  const found = extractTitleLinks(scraped.links, scraped.markdown);
  if (!found.length) return null;

  const want = normTitle(title);
  const scored = found.map((f) => {
    const id = (f.url.match(/tt\d+/) || [])[0] || '';
    const got = normTitle(f.title === id ? '' : f.title);
    let score = 0;
    if (got && got === want) score += 100;
    else if (got && (got.includes(want) || want.includes(got))) score += 40;
    if (year && new RegExp(`\\b${year}\\b`).test(f.title)) score += 30;
    // Prefer titled anchors over bare tt ids
    if (f.title && f.title !== id) score += 10;
    return { id, url: `https://www.imdb.com/title/${id}/`, score, title: f.title };
  }).filter((x) => x.id);

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  // Require a reasonably confident title match — bare first-hit linking poisons the catalog.
  if (!best || best.score < 70) return null;
  return { id: best.id, url: best.url };
}

async function resolveDbTargetsToQueue(targets: DbFilmTarget[], cp: Checkpoint): Promise<QueueItem[]> {
  const queue: QueueItem[] = [];
  for (const t of targets) {
    if (t.imdb_id) {
      queue.push({
        title: t.title,
        url: `https://www.imdb.com/title/${t.imdb_id}/`,
        forceFilmId: t.id,
      });
      continue;
    }
    console.log(`🔎 find IMDb: ${t.title}${t.year ? ` (${t.year})` : ''} [credits=${t.creditCount}]`);
    try {
      const hit = await findImdbTitle(t.title, t.year);
      if (!hit) {
        console.log(`   ✗ no IMDb match`);
        cp.stats.filmsUnmatched++;
        cp.doneFilmIds.push(t.id);
        continue;
      }
      console.log(`   → ${hit.id}`);
      queue.push({ title: t.title, url: hit.url, forceFilmId: t.id });
      await delay(600);
    } catch (e: any) {
      console.warn(`   find fail: ${e.message}`);
      cp.stats.errors++;
    }
  }
  return queue;
}

async function upsertFilm(meta: FilmMeta, cp: Checkpoint, forceFilmId?: string) {
  if (!meta.title && !forceFilmId) return null;

  let existing: any = null;
  if (forceFilmId) {
    const { data } = await supabase
      .from('films')
      .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source,imdb_id,imdb_rating,imdb_vote_count,tmdb_rating')
      .eq('id', forceFilmId)
      .maybeSingle();
    existing = data;
    if (!existing) {
      console.warn(`   force film missing: ${forceFilmId}`);
      cp.stats.errors++;
      return null;
    }
  } else {
    existing = await matchFilm(meta.title!, meta.year, meta.imdbId);
  }

  if (existing) {
    const { patch, skip } = filmPatch(existing, meta);
    if (!existing.countries?.length) patch.countries = ['Nigeria'];
    const ratingOnly =
      Object.keys(patch).every((k) => ['imdb_id', 'imdb_rating', 'imdb_vote_count', 'countries'].includes(k));
    if (skip && Object.keys(patch).length === 0) {
      cp.stats.filmsSkippedRich++;
      console.log(`   ⏭️ rich enough: ${existing.title || meta.title}`);
      return existing.id as string;
    }
    if (skip && !ratingOnly && !(Object.keys(patch).length === 1 && patch.countries)) {
      // Still apply IMDb id/score even when metadata is rich enough.
      const keep: Record<string, any> = {};
      for (const k of ['imdb_id', 'imdb_rating', 'imdb_vote_count', 'countries']) {
        if (k in patch) keep[k] = patch[k];
      }
      Object.keys(patch).forEach((k) => delete patch[k]);
      Object.assign(patch, keep);
      if (!Object.keys(patch).length) {
        cp.stats.filmsSkippedRich++;
        console.log(`   ⏭️ rich enough: ${existing.title || meta.title}`);
        return existing.id as string;
      }
    }
    if (!Object.keys(patch).length) {
      cp.stats.filmsSkippedRich++;
      console.log(`   ⏭️ rich enough: ${existing.title || meta.title}`);
      return existing.id as string;
    }
    if (!DRY) {
      const { error } = await supabase.from('films').update(patch).eq('id', existing.id);
      if (error) {
        console.warn(`   update fail: ${error.message}`);
        cp.stats.errors++;
        return existing.id as string;
      }
    }
    cp.stats.filmsEnriched++;
    console.log(`   ✨ enriched: ${existing.title || meta.title} (${Object.keys(patch).join(', ')})`);
    return existing.id as string;
  }

  cp.stats.filmsCreated++;
  if (DRY) {
    console.log(`   +film ${meta.title}`);
    return null;
  }
  const slug = await uniqueSlug('films', makeSlug(meta.title!));
  const { data, error } = await supabase
    .from('films')
    .insert({
      title: meta.title,
      slug,
      year: meta.year,
      runtime_minutes: meta.runtimeMinutes,
      synopsis: meta.synopsis,
      poster_url: upgradeImdbImage(meta.posterUrl),
      genres: meta.genres.length ? meta.genres : null,
      countries: ['Nigeria'],
      imdb_id: meta.imdbId,
      imdb_rating: meta.rating,
      imdb_vote_count: meta.voteCount,
      source: 'imdb',
      status: 'released',
      needs_review: false,
      is_published: true,
      is_nollywood: true,
    })
    .select('id')
    .single();
  if (error) {
    console.warn(`   create fail: ${error.message}`);
    cp.stats.errors++;
    return null;
  }
  console.log(`   🎬 created: ${meta.title}`);
  return data.id as string;
}

async function upsertPerson(
  name: string,
  role: string,
  filmId: string | null,
  character: string | null,
  img: string | null,
  imdbUrl: string | null,
  cp: Checkpoint,
  thinQueue: Array<{ id: string; url: string; name: string }>,
) {
  let existing = await matchPerson(name);
  const photo = upgradeImdbImage(img);

  if (!existing) {
    cp.stats.peopleCreated++;
    if (!DRY) {
      const slug = await uniqueSlug('people', makeSlug(name));
      const { data, error } = await supabase
        .from('people')
        .insert({
          name,
          slug,
          photo_url: photo,
          source: 'imdb',
          nationality: 'Nigerian',
          known_for_department: role === 'director' ? 'Directing' : 'Acting',
          needs_review: false,
          is_verified: true,
        })
        .select('id,name,bio,photo_url,date_of_birth,birthplace,nationality,source')
        .single();
      if (error) {
        cp.stats.errors++;
        return;
      }
      existing = data;
      console.log(`   👤 created ${name}`);
    } else {
      console.log(`   +person ${name}`);
      return;
    }
  } else if (!existing.photo_url && photo && !DRY) {
    await supabase.from('people').update({ photo_url: photo }).eq('id', existing.id);
    cp.stats.peopleEnriched++;
  }

  if (existing && imdbUrl && personRichness(existing) < 25 && /\/name\/nm\d+/.test(imdbUrl)) {
    thinQueue.push({ id: existing.id, url: imdbUrl.split('?')[0], name });
  }

  if (filmId && existing && !DRY) {
    const { error } = await supabase.from('credits').upsert(
      { film_id: filmId, person_id: existing.id, role, character_name: character },
      { onConflict: 'film_id,person_id,role' },
    );
    if (!error) cp.stats.creditsLinked++;
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (!FIRECRAWL_KEYS.length) {
    console.error('Missing FIRECRAWL_API_KEY');
    process.exit(1);
  }

  const cp = loadCheckpoint();
  console.log(
    `IMDb Africa sync (Firecrawl) dry=${DRY} resume=${RESUME} fromDb=${FROM_DB} `
    + `maxFilms=${MAX_FILMS} fullCredits=${FULL_CREDITS}`
    + (FROM_DB ? ` maxCredits=${MAX_CREDITS}` : ''),
  );
  if (ID_LIST.length) console.log(`ids=${ID_LIST.join(',')}`);
  else if (!FROM_DB) console.log(`countries=${countriesArg.join(',')}`);

  let links: QueueItem[] = [];
  if (ID_LIST.length) {
    links = ID_LIST.map((id) => ({
      title: id,
      url: `https://www.imdb.com/title/${id}/`,
    }));
  } else if (FROM_DB) {
    const doneIds = new Set(cp.doneFilmIds);
    const targets = await collectThinFilmsFromDb(MAX_FILMS, MAX_CREDITS, doneIds);
    console.log(`\n🎯 ${targets.length} thin DB films (credits < ${MAX_CREDITS})`);
    links = await resolveDbTargetsToQueue(targets, cp);
    saveCheckpoint(cp);
  } else {
    links = await collectFilmLinks(countriesArg, MAX_SEARCH_PAGES);
    const done = new Set(cp.doneFilmUrls);
    links = links.filter((l) => !done.has(l.url)).slice(0, MAX_FILMS);
  }
  console.log(`\n🎯 ${links.length} films to process`);

  const thinQueue: Array<{ id: string; url: string; name: string }> = [];

  for (let i = 0; i < links.length; i++) {
    const item = links[i];
    console.log(`\n[${i + 1}/${links.length}] ${item.title}${item.forceFilmId ? ` → ${item.forceFilmId.slice(0, 8)}` : ''}`);
    try {
      const scraped = await firecrawlScrape(item.url);
      let meta = parseFilmFromHtml(scraped.html, item.title);
      if (!meta.title && !item.forceFilmId) {
        cp.stats.errors++;
        continue;
      }

      if (FULL_CREDITS) {
        const creditsUrl = item.url.replace(/\/?$/, '/') + 'fullcredits/';
        console.log(`   📋 fullcredits…`);
        try {
          const creditsPage = await firecrawlScrape(creditsUrl);
          meta = mergeFullCredits(meta, parseFullCredits(creditsPage.html, creditsPage.markdown));
        } catch (e: any) {
          console.warn(`   fullcredits fail: ${e.message}`);
        }
      }

      console.log(
        `   year=${meta.year || '?'} rating=${meta.rating ?? '?'} votes=${meta.voteCount ?? '?'} `
        + `cast=${meta.cast.length} dirs=${meta.directors.length} crew=${meta.crew.length}`,
      );

      const creditHits = meta.cast.length + meta.directors.length + meta.crew.length;
      // From-db search can latch onto empty/wrong IMDb pages — don't stamp a bad imdb_id.
      if (item.forceFilmId && creditHits === 0 && meta.rating == null) {
        console.log(`   ✗ empty IMDb page — skip (no cast/rating)`);
        cp.stats.filmsUnmatched++;
        if (item.forceFilmId) cp.doneFilmIds.push(item.forceFilmId);
        continue;
      }

      const filmId = await upsertFilm(meta, cp, item.forceFilmId);
      const seen = new Set<string>();
      for (const d of meta.directors.slice(0, 6)) {
        const k = d.name.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        await upsertPerson(d.name, 'director', filmId, null, null, d.imdbUrl, cp, thinQueue);
      }
      const castLimit = FULL_CREDITS ? 80 : 15;
      for (const c of meta.cast.slice(0, castLimit)) {
        await upsertPerson(c.name, 'actor', filmId, c.character, c.img, c.imdbUrl, cp, thinQueue);
      }
      for (const c of meta.crew.slice(0, 40)) {
        await upsertPerson(c.name, c.role, filmId, null, null, c.imdbUrl, cp, thinQueue);
      }

      cp.doneFilmUrls.push(item.url);
      if (item.forceFilmId) cp.doneFilmIds.push(item.forceFilmId);
      if ((i + 1) % 5 === 0) saveCheckpoint(cp);
      await delay(400);
    } catch (e: any) {
      console.warn(`   ❌ ${e.message}`);
      cp.stats.errors++;
      if (item.forceFilmId) cp.doneFilmIds.push(item.forceFilmId);
    }
  }

  if (ENRICH_PEOPLE) {
    const seen = new Set<string>();
    const unique = thinQueue.filter((q) => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    }).slice(0, 120);

    console.log(`\n🧬 Enriching ${unique.length} thin people...`);
    for (const p of unique) {
      try {
        const scraped = await firecrawlScrape(p.url);
        const meta = parsePersonFromHtml(scraped.html, p.name);
        const { data: existing } = await supabase
          .from('people')
          .select('id,name,bio,photo_url,date_of_birth,birthplace,nationality')
          .eq('id', p.id)
          .maybeSingle();
        if (!existing) continue;
        const patch = personPatch(existing, meta);
        if (!Object.keys(patch).length) continue;
        if (!DRY) {
          const { error } = await supabase.from('people').update(patch).eq('id', p.id);
          if (error) {
            cp.stats.errors++;
            continue;
          }
        }
        cp.stats.peopleEnriched++;
        console.log(`   ✨ ${p.name} ← ${Object.keys(patch).join(', ')}`);
        await delay(400);
      } catch (e: any) {
        console.warn(`   person fail ${p.name}: ${e.message}`);
        cp.stats.errors++;
      }
    }
  }

  if (!DRY) {
    console.log('\n🔄 Recalculating verified film counts across all enriched people...');
    const { data: allCredits } = await supabase.from('credits').select('person_id');
    const countMap: Record<string, number> = {};
    for (const c of (allCredits || [])) {
      if (c.person_id) countMap[c.person_id] = (countMap[c.person_id] || 0) + 1;
    }
    const pIds = Object.keys(countMap);
    for (let i = 0; i < pIds.length; i += 50) {
      const batch = pIds.slice(i, i + 50);
      await Promise.all(
        batch.map((id) =>
          supabase
            .from('people')
            .update({ film_count: countMap[id], is_verified: true, nationality: 'Nigerian' })
            .eq('id', id)
        )
      );
    }
    console.log('✅ Film counts recalculated.');
  }

  saveCheckpoint(cp);
  fs.writeFileSync(
    REPORT,
    JSON.stringify({
      finishedAt: new Date().toISOString(),
      dryRun: DRY,
      fromDb: FROM_DB,
      maxCredits: FROM_DB ? MAX_CREDITS : undefined,
      countries: FROM_DB ? undefined : countriesArg,
      ids: ID_LIST,
      stats: cp.stats,
    }, null, 2),
  );
  console.log('\n────────────────────────────');
  console.log(JSON.stringify(cp.stats, null, 2));
  console.log(`Report: ${REPORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
