/**
 * api/mirror-images.ts
 *
 * Batch migration endpoint: scans films + people for third-party image URLs
 * and re-hosts them in Supabase Storage.
 *
 * Priority order (worst offenders first):
 *   1. partyjolloftv.com  — active hotlinking of competitor content
 *   2. africanmoviedb.com — competitor CDN
 *   3. Netflix CDN        — will be blocked/nulled (can't fetch)
 *   4. Amazon CDN         — frequently blocks hotlinking
 *   5. i.ytimg.com        — YouTube thumbnails (large volume, low priority)
 *
 * Call via GET/POST with optional ?batch=50&table=films|people
 * Can be triggered manually from Admin or via a Vercel Cron.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './_lib/supabase.js';
import { mirrorImageToStorage, isOwnUrl } from './_lib/image_mirror.js';
import { isValidAuth } from './_lib/auth.js';

export const maxDuration = 60;

/** Domains in priority order. Lower index = processed first. */
const PRIORITY_DOMAINS = [
  'partyjolloftv.com',
  'africanmoviedb.com',
  'vhx.imgix.net',       // Vimeo CDN
  'm.media-amazon.com',  // Amazon
  'nflxso.net',          // Netflix (will be nulled, not mirrored)
  'images.mubicdn.net',  // Mubi CDN
  'bakkaz-files',        // third-party
  '1s8yfxw74q.ufs.sh',  // uploadthing CDN
  'i.ytimg.com',         // YouTube thumbnails (last — large volume)
  'img.static-ottera.com',
];

/** Domains that block fetching — we null them out rather than try to mirror */
const NULL_ON_FAIL_DOMAINS = ['nflxso.net', 'fbcdn.net', 'instagram.f'];

function getFilmnameSafe(title: string, id: string): string {
  return `${id.slice(0, 8)}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authCheck = await isValidAuth(req);
  if (!authCheck.valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const batchSize = parseInt((req.query.batch as string) || '30', 10);
  const table = (req.query.table as string) || 'films'; // 'films' | 'people'

  interface ItemInfo {
    id: string;
    name: string;
    type: 'film' | 'person';
    reason?: string;
    url?: string;
  }

  const results = {
    processed: 0,
    mirrored: 0,
    failed: 0,
    skipped: 0,
    nulled: 0,
    errors: [] as string[],
    failedItems: [] as ItemInfo[],
    clearedItems: [] as ItemInfo[],
  };

  try {
    if (table === 'films') {
      await processFilms(batchSize, results);
    } else if (table === 'people') {
      await processPeople(batchSize, results);
    } else {
      return res.status(400).json({ error: 'Invalid table. Use "films" or "people".' });
    }

    return res.json({
      message: `Batch complete. ${results.mirrored} images mirrored, ${results.failed} failed, ${results.nulled} nulled, ${results.skipped} already OK.`,
      ...results,
    });
  } catch (err: any) {
    console.error('[mirror-images] Fatal error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function processFilms(
  batchSize: number,
  results: { 
    processed: number; 
    mirrored: number; 
    failed: number; 
    skipped: number; 
    nulled: number; 
    errors: string[];
    failedItems: any[];
    clearedItems: any[];
  },
) {
  // Build a query that prioritizes the worst offender domains first
  // We fetch films whose poster_url is NOT already on our own storage or TMDB
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url')
    .not('poster_url', 'is', null)
    .neq('poster_url', '')
    .not('poster_url', 'ilike', '%supabase.co%')       // already ours
    .not('poster_url', 'ilike', '%muvidb.com/media%')  // already ours
    .not('poster_url', 'ilike', '%image.tmdb.org%')    // TMDB — allowed
    .order('created_at', { ascending: false })
    .limit(batchSize);

  if (error) throw error;
  if (!films || films.length === 0) {
    console.log('[mirror-images] No films need mirroring.');
    return;
  }

  // Sort by domain priority so worst offenders go first
  films.sort((a, b) => {
    const getPriority = (url: string | null) => {
      if (!url) return 999;
      const domainIdx = PRIORITY_DOMAINS.findIndex(d => url.includes(d));
      return domainIdx === -1 ? 500 : domainIdx;
    };
    return getPriority(a.poster_url) - getPriority(b.poster_url);
  });

  for (const film of films) {
    results.processed++;

    const domain = film.poster_url ? (() => {
      try { return new URL(film.poster_url).hostname; } catch { return ''; }
    })() : '';

    // Netflix and similar — null them out, don't waste time fetching
    const isBlocked = NULL_ON_FAIL_DOMAINS.some(d => domain.includes(d));
    if (isBlocked) {
      await supabase.from('films').update({ poster_url: null }).eq('id', film.id);
      results.nulled++;
      results.clearedItems.push({ id: film.id, name: film.title, type: 'film', url: film.poster_url });
      console.log(`[mirror-images] ✗ Nulled blocked domain poster for film "${film.title}"`);
      continue;
    }

    const filename = getFilmnameSafe(film.title || 'film', film.id);
    const mirrored = await mirrorImageToStorage(film.poster_url, 'posters', filename);

    if (mirrored) {
      // Also mirror backdrop if it's from the same bad domain (and not already mirrored)
      let newBackdrop: string | null = film.backdrop_url;
      if (film.backdrop_url && !isOwnUrl(film.backdrop_url) && film.backdrop_url !== film.poster_url) {
        newBackdrop = await mirrorImageToStorage(film.backdrop_url, 'backdrops', `${filename}-backdrop`);
      }

      await supabase.from('films').update({
        poster_url: mirrored,
        ...(newBackdrop && newBackdrop !== film.backdrop_url ? { backdrop_url: newBackdrop } : {}),
      }).eq('id', film.id);

      results.mirrored++;
    } else {
      results.failed++;
      results.errors.push(`Film ${film.id} (${film.title}): mirror failed`);
      results.failedItems.push({ id: film.id, name: film.title, type: 'film', reason: 'mirroring failed' });
      console.warn(`[mirror-images] ✗ Could not mirror poster for "${film.title}" from ${film.poster_url}`);
    }
  }
}

async function processPeople(
  batchSize: number,
  results: { 
    processed: number; 
    mirrored: number; 
    failed: number; 
    skipped: number; 
    nulled: number; 
    errors: string[];
    failedItems: any[];
    clearedItems: any[];
  },
) {
  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, photo_url')
    .not('photo_url', 'is', null)
    .neq('photo_url', '')
    .not('photo_url', 'ilike', '%supabase.co%')
    .not('photo_url', 'ilike', '%muvidb.com/media%')
    .not('photo_url', 'ilike', '%image.tmdb.org%')
    .not('photo_url', 'ilike', '%ui-avatars.com%')
    .order('created_at', { ascending: false })
    .limit(batchSize);

  if (error) throw error;
  if (!people || people.length === 0) {
    console.log('[mirror-images] No people need mirroring.');
    return;
  }

  for (const person of people) {
    results.processed++;

    const domain = person.photo_url ? (() => {
      try { return new URL(person.photo_url).hostname; } catch { return ''; }
    })() : '';

    const isBlocked = NULL_ON_FAIL_DOMAINS.some(d => domain.includes(d));
    if (isBlocked) {
      await supabase.from('people').update({ photo_url: null }).eq('id', person.id);
      results.nulled++;
      results.clearedItems.push({ id: person.id, name: person.name, type: 'person', url: person.photo_url });
      continue;
    }

    const filename = `${person.id.slice(0, 8)}-${(person.name || 'person').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
    const mirrored = await mirrorImageToStorage(person.photo_url, 'people', filename);

    if (mirrored) {
      await supabase.from('people').update({ photo_url: mirrored }).eq('id', person.id);
      results.mirrored++;
    } else {
      results.failed++;
      results.errors.push(`Person ${person.id} (${person.name}): mirror failed`);
      results.failedItems.push({ id: person.id, name: person.name, type: 'person', reason: 'mirroring failed' });
    }
  }
}
