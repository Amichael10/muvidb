/**
 * NolliStream DOM scraper → MuviDB
 *
 * Opens a real browser, signs in, scrolls the home rails, intercepts catalogue
 * API responses, and sweeps search so we catch everything the UI can see.
 *
 * Env (.env.local):
 *   NOLLISTREAM_EMAIL
 *   NOLLISTREAM_PASSWORD
 *   SUPABASE_URL / VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run anytime:
 *   npm run sync:nollistream:dom
 *   npm run sync:nollistream:dom -- --dry-run
 *   npm run sync:nollistream:dom -- --manual-login   # you sign in yourself
 *   npm run sync:nollistream:dom -- --headless
 */
import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { supabase } from './lib/db';
import { startSyncLog, type SyncCounters } from './lib/sync';

chromium.use(stealth());

const API_BASE = 'https://backend.nollistream.net';
const WEB_BASE = 'https://nollistream.net';
const PLATFORM = 'nollistream';

const DRY_RUN = process.argv.includes('--dry-run');
const MANUAL_LOGIN = process.argv.includes('--manual-login');
const HEADLESS = process.argv.includes('--headless');

type NolliVideo = {
  _id: string;
  title?: string;
  description?: string;
  category?: string[];
  thumbnail?: string;
  duration?: string;
  cast?: string[];
  director?: string[];
  video_approve_status?: boolean;
};

type NormalizedTitle = {
  sourceId: string;
  title: string;
  synopsis: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  posterUrl: string | null;
  watchUrl: string;
  cast: string[];
  directors: string[];
};

type ExistingFilm = {
  id: string;
  title: string;
  synopsis: string | null;
  runtime_minutes: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[] | null;
  content_type: string | null;
  release_type: string | null;
  source: string | null;
  streaming_links: Record<string, string> | null;
  year: number | null;
  needs_review: boolean | null;
};

const SEARCH_QUERIES = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'0123456789'.split(''),
  'the', 'love', 'movie', 'part', 'man', 'woman', 'king', 'queen',
  'Action', 'Crime', 'Comedy', 'Drama', 'Horror', 'Mystery', 'Family',
  'Adventure', 'Western', 'History', 'Fantasy', 'Fanstasy', 'TV Movie',
];

function normalizeSourceTitle(value: string) {
  return cleanTitle(
    value
      .replace(/\s*\|\s*Movie\s*$/i, '')
      .replace(/\s*\|\s*Movies\s*$/i, '')
      .replace(/\s*\|\s*Series\s*$/i, '')
      .replace(/\s*\|\s*Thriller\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
  ).trim();
}

function isTrailerOrPromo(title: string) {
  const t = title || '';
  if (/\btrailer\b/i.test(t) || /\bteaser\b/i.test(t)) return true;
  if (/nollistream/i.test(t)) return true;
  if (/what'?s next|african stories deserve|wonders of nollywood/i.test(t)) return true;
  if (/^test\b|upload|resume file|mkmk|^wizkid$/i.test(t.trim())) return true;
  return false;
}

function parseRuntime(value?: string) {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) return Math.max(0, parts[0] * 60 + parts[1] + Math.round(parts[2] / 60));
  if (parts.length === 2) return Math.max(0, parts[0] + Math.round(parts[1] / 60));
  return null;
}

function cleanSynopsis(value?: string) {
  if (!value) return null;
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').replace(/\.\.+/g, '.').trim() || null;
}

function normalizePersonName(name: string) {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function ingestVideo(byId: Map<string, NolliVideo>, video: any) {
  if (!video?._id || !video?.title) return;
  if (video.video_approve_status === false) return;
  byId.set(String(video._id), {
    _id: String(video._id),
    title: video.title,
    description: video.description,
    category: video.category,
    thumbnail: video.thumbnail,
    duration: video.duration,
    cast: video.cast,
    director: video.director,
    video_approve_status: video.video_approve_status,
  });
}

function normalizeCatalog(byId: Map<string, NolliVideo>) {
  const titles: NormalizedTitle[] = [];
  let skippedTrailers = 0;

  for (const video of byId.values()) {
    const rawTitle = video.title || '';
    if (isTrailerOrPromo(rawTitle)) {
      skippedTrailers += 1;
      continue;
    }
    const title = normalizeSourceTitle(rawTitle);
    if (!title || isTrailerOrPromo(title)) {
      skippedTrailers += 1;
      continue;
    }
    titles.push({
      sourceId: video._id,
      title,
      synopsis: cleanSynopsis(video.description),
      runtimeMinutes: parseRuntime(video.duration),
      genres: [...new Set((video.category || []).map((g) => String(g).trim()).filter(Boolean))],
      posterUrl: video.thumbnail || null,
      watchUrl: `${WEB_BASE}/movie/${video._id}`,
      cast: [...new Set((video.cast || []).map(normalizePersonName).filter((n) => n.length >= 2))],
      directors: [...new Set((video.director || []).map(normalizePersonName).filter((n) => n.length >= 2))],
    });
  }

  const byTitle = new Map<string, NormalizedTitle>();
  for (const t of titles) {
    const key = t.title.toLocaleLowerCase();
    const prev = byTitle.get(key);
    if (!prev || (t.runtimeMinutes || 0) > (prev.runtimeMinutes || 0)) byTitle.set(key, t);
  }

  return { titles: [...byTitle.values()], discovered: byId.size, skippedTrailers };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scrapeWithBrowser() {
  const email = process.env.NOLLISTREAM_EMAIL?.trim();
  const password = process.env.NOLLISTREAM_PASSWORD?.trim();
  if (!MANUAL_LOGIN && (!email || !password)) {
    throw new Error('Set NOLLISTREAM_EMAIL / NOLLISTREAM_PASSWORD in .env.local (or pass --manual-login)');
  }

  const byId = new Map<string, NolliVideo>();
  const browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  page.on('response', async (response) => {
    try {
      const url = response.url();
      if (!url.includes('backend.nollistream.net/api/video/')) return;
      if (response.status() !== 200) return;
      const json = await response.json().catch(() => null);
      if (!json) return;

      if (Array.isArray(json.sections)) {
        for (const section of json.sections) {
          for (const video of section.videos || []) ingestVideo(byId, video);
        }
      }
      for (const video of json.data || json.videos || []) ingestVideo(byId, video);
    } catch {
      // Ignore non-JSON / aborted responses while navigating.
    }
  });

  try {
    if (MANUAL_LOGIN) {
      console.log('Opening login page — sign in in the browser window…');
      await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.waitForURL(/\/home(\/|$|\?)/, { timeout: 5 * 60_000 });
      console.log('Login detected.');
    } else {
      console.log(`Logging in as ${email}…`);
      await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await page.getByPlaceholder('Email').fill(email!);
      await page.getByPlaceholder('Password').fill(password!);
      await page.getByRole('button', { name: 'Log In' }).click();
      await page.waitForURL(/\/home(\/|$|\?)/, { timeout: 120_000 });
      console.log('Logged in.');
    }

    // Home rails — scroll so lazy rows + network responses fire.
    await page.goto(`${WEB_BASE}/home`, { waitUntil: 'networkidle', timeout: 120_000 }).catch(() => {});
    await sleep(2500);
    for (let i = 0; i < 18; i++) {
      await page.evaluate(() => window.scrollBy(0, 700));
      await sleep(350);
    }
    await page.evaluate(() => window.scrollTo(0, 0));

    // DOM pass: poster alts often carry the title even when text is truncated.
    const domTitles = await page.evaluate(() => {
      const out: Array<{ title: string; src: string }> = [];
      for (const img of Array.from(document.querySelectorAll('img'))) {
        const title = (img.getAttribute('alt') || '').trim();
        const src = img.currentSrc || img.src || '';
        if (!title || title === 'logo' || title === 'User Avatar') continue;
        if (!/nollibucket|cloudinary|thumbnail|images\//i.test(src)) continue;
        out.push({ title, src });
      }
      return out;
    });
    for (const row of domTitles) {
      // DOM alone has no id — keep as soft signal; API ingest is authoritative.
      if (!row.title) continue;
      const fakeKey = `dom:${row.title.toLocaleLowerCase()}`;
      if (![...byId.values()].some((v) => (v.title || '').toLocaleLowerCase() === row.title.toLocaleLowerCase())) {
        // Only add if we somehow have zero API hits for this title later; stash lightly.
        ingestVideo(byId, {
          _id: fakeKey,
          title: row.title,
          thumbnail: row.src,
          video_approve_status: true,
        });
      }
    }

    // Search sweep inside the authenticated page context (uses the session cookie/token).
    console.log('Sweeping search API from the logged-in session…');
    const searchHits = await page.evaluate(async ({ apiBase, queries }) => {
      const token = localStorage.getItem('accessToken');
      if (!token) return { error: 'no accessToken in localStorage', videos: [] as any[] };
      const videos: any[] = [];
      for (const query of queries) {
        try {
          const res = await fetch(`${apiBase}/api/video/search`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query }),
          });
          const json = await res.json();
          for (const v of json.data || json.videos || []) videos.push(v);
        } catch {
          // continue
        }
      }
      return { error: null, videos };
    }, { apiBase: API_BASE, queries: SEARCH_QUERIES });

    if (searchHits.error) console.warn('Search sweep warning:', searchHits.error);
    for (const video of searchHits.videos || []) ingestVideo(byId, video);

    // Drop DOM-only fake ids if a real API id exists for the same title.
    const realByTitle = new Map<string, string>();
    for (const [id, video] of byId) {
      if (id.startsWith('dom:')) continue;
      realByTitle.set((video.title || '').toLocaleLowerCase(), id);
    }
    for (const [id, video] of [...byId.entries()]) {
      if (!id.startsWith('dom:')) continue;
      const real = realByTitle.get((video.title || '').toLocaleLowerCase());
      if (real) byId.delete(id);
    }

    console.log(`Browser scrape collected ${byId.size} unique assets.`);
    return normalizeCatalog(byId);
  } finally {
    await browser.close();
  }
}

function candidateTitles(title: string) {
  const candidates = [title];
  const withoutPart = title.replace(/\s+\((?:1|one|part\s*1)\)$/i, '').trim();
  if (withoutPart && withoutPart !== title) candidates.push(withoutPart);
  return candidates;
}

async function findFilm(title: string) {
  for (const candidate of candidateTitles(title)) {
    const { data, error } = await supabase
      .from('films')
      .select('id,title,synopsis,runtime_minutes,poster_url,backdrop_url,genres,content_type,release_type,source,streaming_links,year,needs_review')
      .ilike('title', candidate)
      .limit(5);
    if (error) throw error;
    if (data?.length) {
      return (data as ExistingFilm[]).sort((a, b) => {
        const score = (film: ExistingFilm) =>
          (film.year ? 4 : 0)
          + (film.poster_url ? 2 : 0)
          + (film.synopsis ? 2 : 0)
          + (film.needs_review === false ? 3 : 0);
        return score(b) - score(a);
      })[0];
    }
  }
  return null;
}

const peopleCache = new Map<string, string | null>();

async function upsertPerson(name: string, roleHint: 'actor' | 'director') {
  const cacheKey = `${roleHint}:${name.toLocaleLowerCase()}`;
  if (peopleCache.has(cacheKey)) return peopleCache.get(cacheKey) || null;

  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    peopleCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: name,
    p_extra: { source: PLATFORM },
  });
  if (error) throw error;
  peopleCache.set(cacheKey, id as unknown as string);
  return id as unknown as string;
}

async function syncCredits(filmId: string, cast: string[], directors: string[]) {
  for (const name of cast) {
    const personId = await upsertPerson(name, 'actor');
    if (!personId) continue;
    const { error } = await supabase.from('credits').upsert(
      { film_id: filmId, person_id: personId, role: 'actor' },
      { onConflict: 'film_id,person_id,role' },
    );
    if (error) throw error;
  }
  for (const name of directors) {
    const personId = await upsertPerson(name, 'director');
    if (!personId) continue;
    const { error } = await supabase.from('credits').upsert(
      { film_id: filmId, person_id: personId, role: 'director' },
      { onConflict: 'film_id,person_id,role' },
    );
    if (error) throw error;
  }
}

function mergeGenres(existing: string[] | null, incoming: string[]) {
  return [...new Set([...(existing || []), ...incoming])];
}

function imageFields(existing: ExistingFilm | null, posterUrl: string | null) {
  const poster = existing?.poster_url || posterUrl || null;
  const backdrop = existing?.backdrop_url || poster || null;
  return { poster_url: poster, backdrop_url: backdrop };
}

async function syncTitle(title: NormalizedTitle, counters: SyncCounters) {
  // Skip DOM-only stubs with no real movie id.
  if (title.sourceId.startsWith('dom:')) {
    console.log(`[skip-dom-only] ${title.title} (no API id — open the title once on NolliStream then re-run)`);
    return 'skipped' as const;
  }

  const existing = await findFilm(title.title);
  if (existing) {
    if (!DRY_RUN) {
      const links = typeof existing.streaming_links === 'object' && existing.streaming_links
        ? existing.streaming_links
        : {};
      const images = imageFields(existing, title.posterUrl);
      const { error } = await supabase.from('films').update({
        streaming_links: { ...links, [PLATFORM]: title.watchUrl },
        synopsis: existing.synopsis || title.synopsis,
        runtime_minutes: existing.runtime_minutes || title.runtimeMinutes,
        ...images,
        genres: mergeGenres(existing.genres, title.genres),
        content_type: existing.content_type || 'movie',
        source: existing.source || PLATFORM,
      }).eq('id', existing.id);
      if (error) throw error;
      await syncCredits(existing.id, title.cast, title.directors);
    }
    counters.updated += 1;
    return 'updated' as const;
  }

  if (!DRY_RUN) {
    const images = imageFields(null, title.posterUrl);
    const { data: inserted, error } = await supabase.from('films').insert({
      title: title.title,
      synopsis: title.synopsis,
      runtime_minutes: title.runtimeMinutes,
      ...images,
      genres: title.genres,
      content_type: 'movie',
      release_type: PLATFORM,
      source: PLATFORM,
      streaming_links: { [PLATFORM]: title.watchUrl },
      status: 'released',
      needs_review: true,
    }).select('id').single();
    if (error) throw error;
    await syncCredits(inserted.id, title.cast, title.directors);
  }
  counters.created += 1;
  return 'created' as const;
}

async function main() {
  const log = DRY_RUN ? null : await startSyncLog(PLATFORM, 'DOM syncing NolliStream catalogue…');
  const counters: SyncCounters = log?.counters || { processed: 0, created: 0, updated: 0, failed: 0 };

  try {
    const { titles, discovered, skippedTrailers } = await scrapeWithBrowser();
    console.log(
      `NolliStream DOM: ${discovered} unique assets, ${titles.length} feature titles `
      + `(${skippedTrailers} trailers/promos skipped).`,
    );

    for (const title of titles) {
      counters.processed += 1;
      try {
        const action = await syncTitle(title, counters);
        if (action === 'skipped') continue;
        const label = DRY_RUN ? (action === 'created' ? 'would-create' : 'would-update') : action;
        console.log(`[${label}] ${title.title} (${title.cast.length} cast)`);
      } catch (error) {
        counters.failed += 1;
        console.error(`[failed] ${title.title}:`, error instanceof Error ? error.message : error);
      }
    }

    if (!DRY_RUN) {
      try {
        await supabase.rpc('refresh_platform_new_releases', { p_platform: PLATFORM });
      } catch {
        // non-fatal
      }
      await log?.finish(
        `NolliStream DOM sync complete. ${counters.created} created, ${counters.updated} updated.`,
        { discovered },
      );
    }

    console.log(
      `NolliStream DOM sync ${DRY_RUN ? 'dry run' : 'complete'}: `
      + `${counters.created} new, ${counters.updated} linked/updated, ${counters.failed} failed.`,
    );
    if (counters.failed) process.exitCode = 1;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await log?.fail(err);
    console.error('NolliStream DOM sync failed:', err.message);
    process.exitCode = 1;
  }
}

main();
