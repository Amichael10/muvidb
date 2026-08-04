/**
 * Sync NolliStream catalogue → MuviDB.
 *
 * - Matches existing films by title and writes streaming_links.nollistream
 * - Creates missing titles (needs_review) with poster/thumbnail
 * - Cast is free text on NolliStream → resolve against people via upsert_person_by_name
 * - No backdrop on NolliStream → poster is used as backdrop (see docs/FILM_IMAGES.md)
 *
 * Env:
 *   NOLLISTREAM_EMAIL / NOLLISTREAM_PASSWORD  (required for catalogue API)
 *
 * Usage:
 *   npx tsx scripts/nollistream_sync.ts --dry-run
 *   npx tsx scripts/nollistream_sync.ts
 */
import { cleanTitle } from '../api/_lib/yt_service.js';
import { supabase } from './lib/db';
import { startSyncLog, type SyncCounters } from './lib/sync';

const API_BASE = 'https://backend.nollistream.net';
const WEB_BASE = 'https://nollistream.net';
const DRY_RUN = process.argv.includes('--dry-run');
const PLATFORM = 'nollistream';

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
  // Platform promos / upload tests that show up in search but aren't features.
  if (/nollistream/i.test(t)) return true;
  if (/what'?s next|african stories deserve|wonders of nollywood/i.test(t)) return true;
  if (/^test\b|upload|resume file|mkmk|^wizkid$/i.test(t.trim())) return true;
  return false;
}

const SEARCH_QUERIES = [
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  ...'0123456789'.split(''),
  'the', 'love', 'movie', 'part', 'man', 'woman', 'king', 'queen',
  'Action', 'Crime', 'Comedy', 'Drama', 'Horror', 'Mystery', 'Family',
  'Adventure', 'Western', 'History', 'Fantasy', 'Fanstasy', 'TV Movie',
];

async function searchCatalog(token: string, byId: Map<string, NolliVideo>) {
  for (const query of SEARCH_QUERIES) {
    try {
      const res = await fetch(`${API_BASE}/api/video/search`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      const json = await res.json() as any;
      if (!res.ok || !json?.success) continue;
      for (const video of json.data || json.videos || []) {
        if (!video?._id || !video?.title) continue;
        if (video.video_approve_status === false) continue;
        byId.set(video._id, video);
      }
    } catch {
      // Keep going — recommended feed is still usable if search flakes.
    }
  }
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

async function login() {
  const email = process.env.NOLLISTREAM_EMAIL?.trim();
  const password = process.env.NOLLISTREAM_PASSWORD?.trim();
  if (!email || !password) {
    throw new Error('Missing NOLLISTREAM_EMAIL or NOLLISTREAM_PASSWORD');
  }
  const res = await fetch(`${API_BASE}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json() as any;
  if (!res.ok || !json?.success || !json?.data?.accessToken) {
    throw new Error(json?.message || `NolliStream login failed (${res.status})`);
  }
  return json.data.accessToken as string;
}

async function fetchCatalog(token: string) {
  const byId = new Map<string, NolliVideo>();

  // Home rails (subset) + search (broader — letter/category sweep).
  const res = await fetch(`${API_BASE}/api/video/recommendedMovies`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json() as any;
  if (!res.ok || !json?.success || !Array.isArray(json.sections)) {
    throw new Error(json?.message || `Catalogue fetch failed (${res.status})`);
  }
  for (const section of json.sections) {
    for (const video of section.videos || []) {
      if (!video?._id || !video?.title) continue;
      if (video.video_approve_status === false) continue;
      byId.set(video._id, video);
    }
  }
  await searchCatalog(token, byId);

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
    const posterUrl = video.thumbnail || null;
    titles.push({
      sourceId: video._id,
      title,
      synopsis: cleanSynopsis(video.description),
      runtimeMinutes: parseRuntime(video.duration),
      genres: [...new Set((video.category || []).map((g) => String(g).trim()).filter(Boolean))],
      posterUrl,
      watchUrl: `${WEB_BASE}/movie/${video._id}`,
      cast: [...new Set((video.cast || []).map(normalizePersonName).filter((n) => n.length >= 2))],
      directors: [...new Set((video.director || []).map(normalizePersonName).filter((n) => n.length >= 2))],
    });
  }

  // Prefer longer runtime when the same title appears twice (e.g. "Downhill" vs cut).
  const byTitle = new Map<string, NormalizedTitle>();
  for (const t of titles) {
    const key = t.title.toLocaleLowerCase();
    const prev = byTitle.get(key);
    if (!prev || (t.runtimeMinutes || 0) > (prev.runtimeMinutes || 0)) byTitle.set(key, t);
  }

  return { titles: [...byTitle.values()], discovered: byId.size, skippedTrailers };
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

/** Poster fills missing backdrop — system rule (docs/FILM_IMAGES.md). */
function imageFields(existing: ExistingFilm | null, posterUrl: string | null) {
  const poster = existing?.poster_url || posterUrl || null;
  const backdrop = existing?.backdrop_url || poster || null;
  return { poster_url: poster, backdrop_url: backdrop };
}

async function syncTitle(title: NormalizedTitle, counters: SyncCounters) {
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
  const log = DRY_RUN ? null : await startSyncLog(PLATFORM, 'Syncing NolliStream catalogue...');
  const counters: SyncCounters = log?.counters || { processed: 0, created: 0, updated: 0, failed: 0 };

  try {
    const token = await login();
    const { titles, discovered, skippedTrailers } = await fetchCatalog(token);
    console.log(
      `NolliStream: ${discovered} unique assets, ${titles.length} feature titles `
      + `(${skippedTrailers} trailers/promos skipped).`,
    );

    for (const title of titles) {
      counters.processed += 1;
      try {
        const action = await syncTitle(title, counters);
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
        // RPC may not list every platform yet — non-fatal.
      }
      await log?.finish(
        `NolliStream sync complete. ${counters.created} created, ${counters.updated} updated.`,
        { discovered },
      );
    }

    console.log(
      `NolliStream sync ${DRY_RUN ? 'dry run' : 'complete'}: `
      + `${counters.created} new, ${counters.updated} linked/updated, ${counters.failed} failed.`,
    );
    if (counters.failed) process.exitCode = 1;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await log?.fail(err);
    console.error('NolliStream sync failed:', err.message);
    process.exitCode = 1;
  }
}

main();
