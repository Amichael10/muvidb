/**
 * Firecrawl-backed IMDb Africa enrich sync (one-time friendly).
 * Playwright often gets empty/blocked IMDb search pages; Firecrawl works.
 *
 *   npx tsx scripts/imdb_bulk_sync.ts --dry-run --max-films 10
 *   npx tsx scripts/imdb_bulk_sync.ts --max-films 150 --countries ng,gh,za,ke
 *   npx tsx scripts/imdb_bulk_sync.ts --resume
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
const MAX_FILMS = Number(args[args.indexOf('--max-films') + 1]) || 200;
const MAX_SEARCH_PAGES = Number(args[args.indexOf('--max-pages') + 1]) || 6;
const ENRICH_PEOPLE = !args.includes('--skip-people-pages');
const countriesArg = args.includes('--countries')
  ? String(args[args.indexOf('--countries') + 1] || '').split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
  : DEFAULT_COUNTRIES;

type FilmMeta = {
  imdbId: string | null;
  title: string | null;
  year: number | null;
  runtimeMinutes: number | null;
  synopsis: string | null;
  posterUrl: string | null;
  genres: string[];
  cast: Array<{ name: string; character: string | null; img: string | null; imdbUrl: string | null }>;
  directors: Array<{ name: string; imdbUrl: string | null }>;
};

type Checkpoint = {
  doneFilmUrls: string[];
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

  return {
    imdbId,
    title: title || fallbackTitle,
    year,
    runtimeMinutes,
    synopsis: synopsis && !isJunkSynopsis(synopsis) ? synopsis : null,
    posterUrl,
    genres,
    cast,
    directors,
  };
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

async function matchFilm(title: string) {
  const { data: exactRows } = await supabase
    .from('films')
    .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source')
    .ilike('title', title)
    .limit(10);
  if (exactRows?.length) return [...exactRows].sort((a, b) => filmRichness(b) - filmRichness(a))[0];

  const { data } = await supabase.rpc('match_film_fuzzy', { query_title: title, threshold: 0.65 });
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  const { data: film } = await supabase
    .from('films')
    .select('id,title,year,synopsis,poster_url,backdrop_url,runtime_minutes,genres,countries,source')
    .eq('id', row.id)
    .maybeSingle();
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
  if (RESUME && fs.existsSync(CHECKPOINT)) return JSON.parse(fs.readFileSync(CHECKPOINT, 'utf8'));
  return {
    doneFilmUrls: [],
    stats: {
      filmsCreated: 0,
      filmsEnriched: 0,
      filmsSkippedRich: 0,
      peopleCreated: 0,
      peopleEnriched: 0,
      creditsLinked: 0,
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

async function upsertFilm(meta: FilmMeta, cp: Checkpoint) {
  if (!meta.title) return null;
  const existing = await matchFilm(meta.title);

  if (existing) {
    const { patch, skip } = filmPatch(existing, meta);
    if (skip || !Object.keys(patch).length) {
      cp.stats.filmsSkippedRich++;
      console.log(`   ⏭️ rich enough: ${meta.title}`);
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
    console.log(`   ✨ enriched: ${meta.title} (${Object.keys(patch).join(', ')})`);
    return existing.id as string;
  }

  cp.stats.filmsCreated++;
  if (DRY) {
    console.log(`   +film ${meta.title}`);
    return null;
  }
  const slug = await uniqueSlug('films', makeSlug(meta.title));
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
      source: 'imdb',
      status: 'released',
      needs_review: true,
      is_published: true,
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
          known_for_department: role === 'director' ? 'Directing' : 'Acting',
          needs_review: true,
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
  console.log(`IMDb Africa sync (Firecrawl) dry=${DRY} resume=${RESUME} maxFilms=${MAX_FILMS}`);
  console.log(`countries=${countriesArg.join(',')}`);

  let links = await collectFilmLinks(countriesArg, MAX_SEARCH_PAGES);
  const done = new Set(cp.doneFilmUrls);
  links = links.filter((l) => !done.has(l.url)).slice(0, MAX_FILMS);
  console.log(`\n🎯 ${links.length} films to process`);

  const thinQueue: Array<{ id: string; url: string; name: string }> = [];

  for (let i = 0; i < links.length; i++) {
    const item = links[i];
    console.log(`\n[${i + 1}/${links.length}] ${item.title}`);
    try {
      const scraped = await firecrawlScrape(item.url);
      const meta = parseFilmFromHtml(scraped.html, item.title);
      if (!meta.title) {
        cp.stats.errors++;
        continue;
      }
      console.log(`   year=${meta.year || '?'} cast=${meta.cast.length} dirs=${meta.directors.length}`);

      const filmId = await upsertFilm(meta, cp);
      const seen = new Set<string>();
      for (const d of meta.directors.slice(0, 4)) {
        const k = d.name.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        await upsertPerson(d.name, 'director', filmId, null, null, d.imdbUrl, cp, thinQueue);
      }
      for (const c of meta.cast.slice(0, 15)) {
        await upsertPerson(c.name, 'actor', filmId, c.character, c.img, c.imdbUrl, cp, thinQueue);
      }

      cp.doneFilmUrls.push(item.url);
      if ((i + 1) % 5 === 0) saveCheckpoint(cp);
      await delay(400);
    } catch (e: any) {
      console.warn(`   ❌ ${e.message}`);
      cp.stats.errors++;
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

  saveCheckpoint(cp);
  fs.writeFileSync(
    REPORT,
    JSON.stringify({ finishedAt: new Date().toISOString(), dryRun: DRY, countries: countriesArg, stats: cp.stats }, null, 2),
  );
  console.log('\n────────────────────────────');
  console.log(JSON.stringify(cp.stats, null, 2));
  console.log(`Report: ${REPORT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
