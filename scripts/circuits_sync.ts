import { randomUUID } from 'node:crypto';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { supabase } from './lib/db';
import { startSyncLog, type SyncCounters } from './lib/sync';

const API_BASE = (process.env.CIRCUITS_API_URL || 'https://insight-api-shared.univtec.com/').replace(/\/?$/, '/');
const WEB_BASE = (process.env.CIRCUITS_WEB_URL || 'https://www.circuits.tv').replace(/\/$/, '');
const ACCOUNT_ID = process.env.CIRCUITS_ACCOUNT_ID || '665f5ba15129dedac9b94a7a';
const TENANT_ID = process.env.CIRCUITS_TENANT_ID || 'papaya';
const HOME_PAGE_ID = process.env.CIRCUITS_HOME_PAGE_ID || '646792d82a19035a166745f6';
const DRY_RUN = process.argv.includes('--dry-run');

type CircuitsItem = {
  id?: string;
  guid?: string;
  title?: string;
  description?: string;
  longDescription?: string;
  duration?: string;
  genre?: string;
  entity?: string;
  type?: string;
  date?: number;
  optimizedPoster?: string;
  poster?: string;
  optimizedImage?: string;
  image?: string;
  cast_field?: string;
};

type CircuitsSection = {
  title?: string;
  sectionId?: string;
  parentComponent?: string;
  count?: number;
};

type NormalizedTitle = {
  sourceId: string;
  title: string;
  synopsis: string | null;
  runtimeMinutes: number | null;
  genres: string[];
  contentType: 'movie' | 'series';
  posterUrl: string | null;
  backdropUrl: string | null;
  watchUrl: string;
  cast: string[];
  sourceDate: number;
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
  year: number | null;
  needs_review: boolean | null;
};

const TITLE_ALIASES: Record<string, string> = {
  arbirtration: 'The Arbitration',
  'up north (christmas deal)': 'Up North',
  'king of thieves (1)': 'Agesinkole: King of Thieves',
  'taxi driver': 'Taxi Driver: Oko Ashewo',
};

function normalizeSourceTitle(value: string) {
  const cleaned = cleanTitle(value).trim();
  return TITLE_ALIASES[cleaned.toLocaleLowerCase()] || cleaned;
}

function parseRuntime(value?: string) {
  if (!value) return null;
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  const minutes = parts.length === 3
    ? parts[0] * 60 + parts[1] + Math.round(parts[2] / 60)
    : parts.length === 2
      ? parts[0] + Math.round(parts[1] / 60)
      : null;
  return minutes === null ? null : Math.max(0, minutes);
}

function cleanSynopsis(value: string | undefined) {
  if (!value) return null;
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\.\.+/g, '.')
    .trim() || null;
}

function parseGenres(value?: string) {
  return [...new Set((value || '')
    .split(/[,|/]/)
    .map((genre) => genre.trim())
    .filter(Boolean))];
}

function normalizeCast(value?: string) {
  return [...new Set((value || '')
    .split(',')
    .map((name) => name.replace(/\s*\([^)]*\)\s*$/, '').replace(/\s+/g, ' ').trim())
    .filter((name) => name.length >= 2 && name.length <= 80)
    .filter((name) => !/[a-z][A-Z]/.test(name)))];
}

function getWatchUrl(item: CircuitsItem) {
  const route = ['series', 'show', 'program'].includes((item.entity || '').toLowerCase()) ? 'serie' : 'vod';
  return `${WEB_BASE}/${route}/${item.id}`;
}

function isPromotional(item: CircuitsItem, runtimeMinutes: number | null) {
  const text = `${item.title || ''} ${item.description || ''}`;
  return /\bpre[- ]?order\b/i.test(text)
    || (runtimeMinutes !== null && runtimeMinutes < 10);
}

async function fetchJson<T>(url: string, init: RequestInit = {}) {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json() as Promise<T>;
}

async function fetchCatalog() {
  const email = process.env.CIRCUITS_EMAIL?.trim();
  const password = process.env.CIRCUITS_PASSWORD?.trim();
  if (!email || !password) throw new Error('Missing CIRCUITS_EMAIL or CIRCUITS_PASSWORD');

  const baseHeaders = {
    platform: 'web',
    'x-device-type': 'web',
    'x-tenant-id': TENANT_ID,
    'x-device': `${randomUUID()};Windows;10;1.0;Chrome`,
    'Content-Type': 'application/json',
  };
  const login = await fetchJson<any>(`${API_BASE}cms/interface/visitors/login`, {
    method: 'POST',
    headers: baseHeaders,
    body: JSON.stringify({ accountId: ACCOUNT_ID, email: email.toLowerCase(), password }),
  });
  if (!login?.data?.token) {
    throw new Error(login?.error?.code || 'Circuits login failed');
  }

  const headers = {
    ...baseHeaders,
    Authorization: `Bearer ${login.data.token}`,
    'x-profile-id': login.data.visitor?.profiles?.[0]?.id || login.data.visitor?.guid,
  };
  const page = await fetchJson<{ sections?: CircuitsSection[] }>(
    `${API_BASE}interface/pages/${HOME_PAGE_ID}`,
    { headers: { ...headers, 'x-no-items': '1' } },
  );
  const sections = (page.sections || []).filter((section) =>
    Boolean(
      section.sectionId
      && section.count
      && section.parentComponent !== 'Banner'
      && !['Keep Watching', 'My List', 'Preorder'].includes(section.title || ''),
    ),
  );

  const catalog = new Map<string, CircuitsItem>();
  for (const section of sections) {
    let pageNumber = 1;
    const sectionItems = new Map<string, CircuitsItem>();
    while (pageNumber <= 20) {
      const result = await fetchJson<{ items?: CircuitsItem[] }>(
        `${API_BASE}interface/pages/section/${section.sectionId}?page=${pageNumber}&limit=50`,
        { headers: { ...headers, 'x-no-verbose-items': 'ok' } },
      );
      const items = result.items || [];
      const previousSize = sectionItems.size;
      for (const item of items) {
        const entity = (item.entity || '').toLowerCase();
        if (!item.id || !item.title || !['vods', 'series'].includes(entity)) continue;
        sectionItems.set(`${entity}:${item.id}`, item);
      }
      if (!items.length || sectionItems.size === previousSize || sectionItems.size >= (section.count || 0)) break;
      pageNumber += 1;
    }
    for (const [key, item] of sectionItems) catalog.set(key, item);
  }

  let skippedPromotional = 0;
  const titles = [...catalog.values()]
    .map((item): NormalizedTitle | null => {
      const title = normalizeSourceTitle(item.title || '');
      const runtimeMinutes = parseRuntime(item.duration);
      if (!title || !item.id || isPromotional(item, runtimeMinutes)) {
        skippedPromotional += 1;
        return null;
      }
      return {
        sourceId: item.id,
        title,
        synopsis: cleanSynopsis(item.longDescription || item.description),
        runtimeMinutes,
        genres: parseGenres(item.genre),
        contentType: (item.entity || '').toLowerCase() === 'series' ? 'series' : 'movie',
        posterUrl: item.optimizedPoster || item.poster || item.optimizedImage || item.image || null,
        backdropUrl: item.optimizedImage || item.image || item.optimizedPoster || item.poster || null,
        watchUrl: getWatchUrl(item),
        cast: normalizeCast(item.cast_field),
        sourceDate: typeof item.date === 'number' ? item.date : 0,
      };
    })
    .filter((title): title is NormalizedTitle => Boolean(title))
    .sort((a, b) => a.sourceDate - b.sourceDate);

  return { titles, discovered: catalog.size, skippedPromotional };
}

function mergeGenres(existing: string[] | null, incoming: string[]) {
  return [...new Set([...(existing || []), ...incoming])];
}

function candidateTitles(title: string) {
  const candidates = [title];
  const withoutPartOne = title.replace(/\s+\((?:1|one)\)$/i, '').trim();
  if (withoutPartOne && withoutPartOne !== title) candidates.push(withoutPartOne);
  return candidates;
}

async function findFilm(title: string) {
  for (const candidate of candidateTitles(title)) {
    const { data, error } = await supabase
      .from('films')
      .select('id,title,synopsis,runtime_minutes,poster_url,backdrop_url,genres,content_type,release_type,source,streaming_links,youtube_watch_url,year,needs_review')
      .ilike('title', candidate)
      .limit(5);
    if (error) throw error;
    if (data?.length) {
      return (data as ExistingFilm[]).sort((a, b) => {
        const score = (film: ExistingFilm) =>
          (film.year ? 4 : 0)
          + (film.poster_url ? 2 : 0)
          + (film.synopsis ? 2 : 0)
          + (film.needs_review === false ? 3 : 0)
          + (['manual', 'imdb', 'tmdb'].includes(film.source || '') ? 2 : 0);
        return score(b) - score(a);
      })[0];
    }
  }
  return null;
}

const peopleCache = new Map<string, string | null>();

async function upsertActor(name: string) {
  const cacheKey = name.toLocaleLowerCase();
  if (peopleCache.has(cacheKey)) return peopleCache.get(cacheKey) || null;

  const { data: existing, error: findError } = await supabase
    .from('people')
    .select('id,source')
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    if (!existing.source) await supabase.from('people').update({ source: 'circuits' }).eq('id', existing.id);
    peopleCache.set(cacheKey, existing.id);
    return existing.id;
  }

  // // Shared matcher (migration 20260723112408): exact name, else
  // people.name_key (order-insensitive + honorific-stripped), so
  // "Kosoko Jide" / "Prince Jide Kosoko" resolve to the existing person.
  const { data: id, error } = await supabase.rpc('upsert_person_by_name', {
    p_name: name,
    p_extra: { source: 'circuits' },
  });
  if (error) throw error;
  peopleCache.set(cacheKey, id as unknown as string);
  return id as unknown as string;
}

async function syncCast(filmId: string, cast: string[]) {
  for (const name of cast) {
    const personId = await upsertActor(name);
    if (!personId) continue;
    const { error } = await supabase.from('credits').upsert(
      { film_id: filmId, person_id: personId, role: 'actor' },
      { onConflict: 'film_id,person_id,role' },
    );
    if (error) throw error;
  }
}

async function syncTitle(title: NormalizedTitle, counters: SyncCounters) {
  const existing = await findFilm(title.title);
  if (existing) {
    if (!DRY_RUN) {
      const links = typeof existing.streaming_links === 'object' && existing.streaming_links
        ? existing.streaming_links
        : {};
      const updatePayload: Record<string, unknown> = {
        streaming_links: { ...links, circuits: title.watchUrl },
        synopsis: existing.synopsis || title.synopsis,
        runtime_minutes: existing.runtime_minutes || title.runtimeMinutes,
        poster_url: existing.poster_url || title.posterUrl,
        backdrop_url: existing.backdrop_url || title.backdropUrl,
        genres: mergeGenres(existing.genres, title.genres),
        content_type: existing.content_type || title.contentType,
        source: existing.source || 'circuits',
        release_type: existing.release_type || 'circuits',
      };
      const { error } = await supabase.from('films').update(updatePayload).eq('id', existing.id);
      if (error) throw error;
      await syncCast(existing.id, title.cast);
    }
    counters.updated += 1;
    return 'updated' as const;
  }

  if (!DRY_RUN) {
    const { data: inserted, error } = await supabase.from('films').insert({
      title: title.title,
      synopsis: title.synopsis,
      runtime_minutes: title.runtimeMinutes,
      poster_url: title.posterUrl,
      backdrop_url: title.backdropUrl,
      genres: title.genres,
      content_type: title.contentType,
      release_type: 'circuits',
      source: 'circuits',
      streaming_links: { circuits: title.watchUrl },
      status: 'released',
      needs_review: true,
    }).select('id').single();
    if (error) throw error;
    await syncCast(inserted.id, title.cast);
  }
  counters.created += 1;
  return 'created' as const;
}

async function main() {
  const log = DRY_RUN ? null : await startSyncLog('circuits', 'Syncing Circuits catalogue...');
  const counters: SyncCounters = log?.counters || { processed: 0, created: 0, updated: 0, failed: 0 };

  try {
    const { titles, discovered, skippedPromotional } = await fetchCatalog();
    console.log(`Circuits: ${discovered} unique entries, ${titles.length} eligible titles, ${skippedPromotional} promotional assets skipped.`);

    for (const title of titles) {
      counters.processed += 1;
      try {
        const action = await syncTitle(title, counters);
        const label = DRY_RUN ? (action === 'created' ? 'would-create' : 'would-update') : action;
        console.log(`[${label}] ${title.title}`);
      } catch (error) {
        counters.failed += 1;
        console.error(`[failed] ${title.title}:`, error instanceof Error ? error.message : error);
      }
    }

    if (!DRY_RUN) {
      const { error } = await supabase.rpc('refresh_platform_new_releases', { p_platform: 'circuits' });
      if (error) throw error;
      await log?.finish(
        `Circuits sync complete. ${counters.created} created, ${counters.updated} updated.`,
        { discovered, skippedPromotional },
      );
    }

    console.log(`Circuits sync ${DRY_RUN ? 'dry run' : 'complete'}: ${counters.created} new, ${counters.updated} updated, ${counters.failed} failed.`);
    if (counters.failed) process.exitCode = 1;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    await log?.fail(err);
    console.error('Circuits sync failed:', err.message);
    process.exitCode = 1;
  }
}

main();
