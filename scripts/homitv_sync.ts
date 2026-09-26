import fs from 'node:fs';
import path from 'node:path';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { supabase } from './lib/db';
import { startSyncLog, type SyncCounters } from './lib/sync';
import { uploadTrailerToR2 } from './harvest_homitv_trailers';

const API_BASE = 'https://api.homitv.com/medias/api/v2';
const WEB_BASE = 'https://homitv.com';
const PLATFORM = 'homitv';
const DRY_RUN = process.argv.includes('--dry-run');
const HARVEST_TRAILERS = process.argv.includes('--harvest-trailers');

export type HomiTvItem = {
  id?: number | string;
  title: string;
  slug: string;
  description?: string;
  thumbnail_image?: string;
  poster_image?: string;
  hls_playlist_url?: string;
  trailer_hls_url?: string | null;
  trailer_status?: string | null;
  genre_name?: string;
  video_category_name?: string;
  video_duration?: string;
  video_duration_seconds?: number;
  published_on?: number | string;
  presenter?: string;
  is_premium?: number;
};

export type NormalizedHomiTitle = {
  sourceId: string;
  slug: string;
  title: string;
  synopsis: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  backdropUrl: string | null;
  watchUrl: string;
  trailerUrl: string | null;
  hlsUrl?: string | null;
  cast: string[];
  year: number | null;
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
  youtube_watch_url: string | null;
  trailer_external_url: string | null;
  year: number | null;
  needs_review: boolean | null;
};

function normalizeSourceTitle(value: string) {
  return cleanTitle(value || '').trim();
}

function parseRuntime(durationStr?: string, seconds?: number): number | null {
  if (typeof seconds === 'number' && seconds > 0) {
    return Math.max(1, Math.round(seconds / 60));
  }
  if (!durationStr) return null;
  const parts = durationStr.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 3) {
    return Math.max(1, parts[0] * 60 + parts[1] + Math.round(parts[2] / 60));
  }
  if (parts.length === 2) {
    return Math.max(1, parts[0] + Math.round(parts[1] / 60));
  }
  return null;
}

function normalizeCast(value?: string): string[] {
  if (!value) return [];
  return [...new Set(
    value
      .split(/[,|/]/)
      .map((name) => name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim())
      .filter((name) => name.length >= 2 && name.length <= 80)
      .filter((name) => !/[a-z][A-Z]/.test(name))
  )];
}

function parseGenres(genre?: string, category?: string): string[] {
  const set = new Set<string>();
  if (genre) {
    genre.split(/[,|/]/).forEach((g) => {
      const clean = g.trim();
      if (clean && !clean.toLowerCase().includes('movie')) set.add(clean);
    });
  }
  if (category) {
    category.split(/[-–—,/]/).forEach((c) => {
      const clean = c.trim();
      if (clean && !clean.toLowerCase().includes('movie')) set.add(clean);
    });
  }
  return [...set];
}

async function fetchCatalogFromApi(): Promise<HomiTvItem[]> {
  const items: HomiTvItem[] = [];
  let page = 1;
  while (page <= 10) {
    try {
      const res = await fetch(`${API_BASE}/home_page?page=${page}`, {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) break;
      const json: any = await res.json();
      const pageData = json?.data || [];
      if (!Array.isArray(pageData) || pageData.length === 0) break;
      for (const it of pageData) {
        if (it?.slug && !items.some((x) => x.slug === it.slug)) {
          items.push(it);
        }
      }
      if (!json?.links?.next) break;
      page += 1;
    } catch {
      break;
    }
  }
  return items;
}

async function fetchVideoDetails(slug: string): Promise<Partial<HomiTvItem> | null> {
  try {
    const res = await fetch(`${API_BASE}/videos/${slug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ screen: '' }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.data || null;
  } catch {
    return null;
  }
}

async function loadCatalog(): Promise<HomiTvItem[]> {
  console.log('[HomiTV] Attempting live API fetch...');
  const liveItems = await fetchCatalogFromApi();
  if (liveItems.length > 0) {
    console.log(`[HomiTV] Fetched ${liveItems.length} live items from API.`);
    return liveItems;
  }

  console.log('[HomiTV] Live API unavailable; loading cached catalog sample...');
  const samplePath = path.resolve('scratch/homitv_catalog_sample.json');
  if (fs.existsSync(samplePath)) {
    const raw = fs.readFileSync(samplePath, 'utf8');
    const items = JSON.parse(raw);
    console.log(`[HomiTV] Loaded ${items.length} items from ${samplePath}.`);
    return items;
  }

  throw new Error('Unable to fetch HomiTV catalog from API or local cache');
}

const peopleCache = new Map<string, string | null>();

async function upsertActor(name: string) {
  const cacheKey = name.toLowerCase();
  if (peopleCache.has(cacheKey)) return peopleCache.get(cacheKey) || null;

  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id,source')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) {
    if (!existing.source) await supabase.from('people').update({ source: PLATFORM }).eq('id', existing.id);
    peopleCache.set(cacheKey, existing.id);
    return existing.id;
  }

  const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: name,
    p_extra: { source: PLATFORM },
  });
  if (error) {
    console.warn(`Could not upsert actor "${name}":`, error.message);
    return null;
  }
  const personId = id as unknown as string;
  peopleCache.set(cacheKey, personId);
  return personId;
}

async function syncCast(filmId: string, cast: string[]) {
  for (const name of cast) {
    try {
      const personId = await upsertActor(name);
      if (!personId) continue;
      await supabase.from('credits').upsert(
        { film_id: filmId, person_id: personId, role: 'actor' },
        { onConflict: 'film_id,person_id,role' }
      );
    } catch (e: any) {
      console.warn(`Cast credit failed for "${name}":`, e.message);
    }
  }
}

const existingMap = new Map<string, ExistingFilm>();

async function prefetchExistingFilms(titles: NormalizedHomiTitle[]) {
  const slugs = titles.map((t) => t.slug).filter(Boolean);
  console.log(`[HomiTV] Prefetching existing films by slug & platform...`);

  // 1. Fetch by slugs
  if (slugs.length > 0) {
    const chunkSize = 50;
    for (let i = 0; i < slugs.length; i += chunkSize) {
      const chunk = slugs.slice(i, i + chunkSize);
      try {
        const { data } = await supabase
          .from('films')
          .select('id,title,slug,synopsis,runtime_minutes,poster_url,backdrop_url,genres,content_type,release_type,source,streaming_links,youtube_watch_url,trailer_external_url,year,needs_review')
          .in('slug', chunk);

        (data || []).forEach((f: any) => {
          if (f.slug) existingMap.set(f.slug.toLowerCase(), f);
          if (f.title) existingMap.set(f.title.toLowerCase().trim(), f);
        });
      } catch (err: any) {
        console.warn('Slug prefetch warning:', err.message);
      }
    }
  }

  // 2. Fetch existing films with homitv source or streaming link
  try {
    const { data: homiFilms } = await supabase
      .from('films')
      .select('id,title,slug,synopsis,runtime_minutes,poster_url,backdrop_url,genres,content_type,release_type,source,streaming_links,youtube_watch_url,trailer_external_url,year,needs_review')
      .or('source.eq.homitv,streaming_links->>homitv.not.is.null')
      .limit(300);

    (homiFilms || []).forEach((f: any) => {
      if (f.slug) existingMap.set(f.slug.toLowerCase(), f);
      if (f.title) existingMap.set(f.title.toLowerCase().trim(), f);
    });
  } catch (err: any) {
    console.warn('Platform prefetch warning:', err.message);
  }

  console.log(`[HomiTV] Prefetched ${existingMap.size} candidates into memory cache.`);
}

async function findFilm(title: string, slug?: string): Promise<ExistingFilm | null> {
  if (slug && existingMap.has(slug.toLowerCase())) {
    return existingMap.get(slug.toLowerCase())!;
  }

  const clean = cleanTitle(title);
  const candidates = [title.toLowerCase().trim(), clean.toLowerCase().trim()];

  for (const c of candidates) {
    if (existingMap.has(c)) {
      return existingMap.get(c)!;
    }
  }

  // Fallback direct query if not in cache
  try {
    const { data, error } = await supabase
      .from('films')
      .select('id,title,synopsis,runtime_minutes,poster_url,backdrop_url,genres,content_type,release_type,source,streaming_links,youtube_watch_url,trailer_external_url,year,needs_review')
      .ilike('title', title)
      .limit(1);

    if (!error && data?.length) {
      const match = data[0] as ExistingFilm;
      existingMap.set(title.toLowerCase().trim(), match);
      return match;
    }
  } catch {
    // Ignore transient query error and proceed
  }

  return null;
}

async function syncTitle(title: NormalizedHomiTitle, counters: SyncCounters): Promise<'created' | 'updated'> {
  let trailerToSave = title.trailerUrl;

  if (HARVEST_TRAILERS && trailerToSave && trailerToSave.includes('.m3u8')) {
    try {
      const r2 = await uploadTrailerToR2(title.slug, trailerToSave);
      trailerToSave = r2.publicUrl;
      console.log(`  [R2 Trailer] Saved trailer for "${title.title}": ${trailerToSave}`);
    } catch (err: any) {
      console.warn(`  [R2 Trailer] Failed to harvest trailer for "${title.title}":`, err.message);
    }
  }

  const existing = await findFilm(title.title, title.slug);
  if (existing) {
    if (!DRY_RUN) {
      const links = typeof existing.streaming_links === 'object' && existing.streaming_links
        ? existing.streaming_links
        : {};

      const bestPoster = (existing.poster_url && existing.poster_url.length > 5 && !existing.poster_url.includes('placeholder'))
        ? existing.poster_url
        : title.posterUrl;

      const bestBackdrop = (existing.backdrop_url && existing.backdrop_url.length > 5 && !existing.backdrop_url.includes('placeholder'))
        ? existing.backdrop_url
        : (title.backdropUrl || bestPoster);

      const bestSynopsis = (existing.synopsis && existing.synopsis.length >= (title.synopsis?.length || 0))
        ? existing.synopsis
        : (title.synopsis || existing.synopsis);

      const bestTrailer = existing.trailer_external_url || trailerToSave;

      const updatePayload: Record<string, unknown> = {
        streaming_links: {
          ...links,
          [PLATFORM]: title.watchUrl,
          homitv_info: `${WEB_BASE}/video/${title.slug}`,
          ...(title.hlsUrl ? { homitv_hls: title.hlsUrl } : {}),
        },
        synopsis: bestSynopsis,
        runtime_minutes: existing.runtime_minutes || title.runtimeMinutes,
        poster_url: bestPoster,
        backdrop_url: bestBackdrop,
        trailer_external_url: bestTrailer,
        trailer_source: bestTrailer ? (existing.trailer_external_url ? undefined : 'external') : undefined,
        genres: [...new Set([...(existing.genres || []), ...title.genres])],
        source: existing.source || PLATFORM,
        release_type: (existing.source === PLATFORM || !existing.release_type || existing.release_type === 'unreleased') ? PLATFORM : existing.release_type,
      };

      const { error } = await supabase.from('films').update(updatePayload).eq('id', existing.id);
      if (error) throw error;

      await syncCast(existing.id, title.cast);

      // Upsert into platform_new_releases queue
      await supabase.from('platform_new_releases').upsert({
        platform: PLATFORM,
        film_id: existing.id,
        display_order: -1,
        entry_source: 'auto',
        is_hidden: false,
      }, { onConflict: 'platform,film_id' });
    }
    counters.updated += 1;
    return 'updated';
  }

  if (!DRY_RUN) {
    const { data: inserted, error } = await supabase.from('films').insert({
      title: title.title,
      slug: title.slug,
      synopsis: title.synopsis,
      runtime_minutes: title.runtimeMinutes,
      poster_url: title.posterUrl,
      backdrop_url: title.backdropUrl,
      trailer_external_url: trailerToSave,
      trailer_source: trailerToSave ? 'external' : 'youtube',
      genres: title.genres,
      content_type: title.contentType,
      release_type: PLATFORM,
      source: PLATFORM,
      streaming_links: {
        [PLATFORM]: title.watchUrl,
        homitv_info: `${WEB_BASE}/video/${title.slug}`,
        ...(title.hlsUrl ? { homitv_hls: title.hlsUrl } : {}),
      },
      year: title.year,
      status: 'released',
      needs_review: true,
    }).select('id').single();

    if (error) throw error;

    await syncCast(inserted.id, title.cast);

    await supabase.from('platform_new_releases').upsert({
      platform: PLATFORM,
      film_id: inserted.id,
      display_order: -1,
      entry_source: 'auto',
      is_hidden: false,
    }, { onConflict: 'platform,film_id' });
  }

  counters.created += 1;
  return 'created';
}

async function main() {
  const log = DRY_RUN ? null : await startSyncLog(PLATFORM, 'Syncing HomiTV catalogue...');
  const counters: SyncCounters = log?.counters || { processed: 0, created: 0, updated: 0, failed: 0 };

  console.log(`Starting HomiTV sync (dry-run: ${DRY_RUN}, harvest-trailers: ${HARVEST_TRAILERS})...`);

  try {
    const rawItems = await loadCatalog();
    console.log(`Found ${rawItems.length} HomiTV catalogue items.`);

    const normalizedList: NormalizedHomiTitle[] = [];

    for (const item of rawItems) {
      const title = normalizeSourceTitle(item.title);
      if (!title || !item.slug) continue;

      const runtime = parseRuntime(item.video_duration, item.video_duration_seconds);
      const cast = normalizeCast(item.presenter);
      const genres = parseGenres(item.genre_name, item.video_category_name);
      const year = typeof item.published_on === 'number'
        ? item.published_on
        : (item.published_on ? parseInt(String(item.published_on), 10) || null : null);

      normalizedList.push({
        sourceId: String(item.id || item.slug),
        slug: item.slug,
        title,
        synopsis: item.description?.trim() || null,
        runtimeMinutes: runtime,
        genres,
        contentType: 'movie',
        posterUrl: item.poster_image || item.thumbnail_image || null,
        backdropUrl: item.thumbnail_image || item.poster_image || null,
        watchUrl: `${WEB_BASE}/watch/${item.slug}`,
        trailerUrl: item.trailer_hls_url || null,
        hlsUrl: item.hls_playlist_url || null,
        cast,
        year,
      });
    }

    console.log(`Normalized ${normalizedList.length} titles ready to sync.`);

    await prefetchExistingFilms(normalizedList);

    for (const item of normalizedList) {
      counters.processed += 1;
      try {
        const action = await syncTitle(item, counters);
        const label = DRY_RUN ? (action === 'created' ? 'would-create' : 'would-update') : action;
        console.log(`[${label}] ${item.title} (${item.slug})`);
      } catch (err: any) {
        counters.failed += 1;
        console.error(`[failed] ${item.title}:`, err.message);
      }
    }

    if (!DRY_RUN) {
      try {
        await supabase.rpc('refresh_platform_new_releases', { p_platform: PLATFORM });
      } catch (rpcErr: any) {
        console.warn('refresh_platform_new_releases notice:', rpcErr.message);
      }

      await log?.finish(
        `HomiTV sync complete. ${counters.created} created, ${counters.updated} updated.`,
        { discovered: rawItems.length }
      );
    }

    console.log(`\n🎉 HomiTV sync ${DRY_RUN ? 'dry run' : 'complete'}: ${counters.created} new, ${counters.updated} updated, ${counters.failed} failed.`);
    if (counters.failed > 0) process.exitCode = 1;
  } catch (error: any) {
    await log?.fail(error);
    console.error('HomiTV sync fatal error:', error.message);
    process.exitCode = 1;
  }
}

main();
