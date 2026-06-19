import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from './supabase.js';
import { mirrorImageToStorage, isOwnUrl } from './image_mirror.js';
import { isValidAuth } from './auth.js';

export const config = { maxDuration: 60 };

const NULL_ON_FAIL_DOMAINS = ['nflxso.net', 'fbcdn.net', 'instagram.f'];

const PRIORITY_DOMAINS = [
  'partyjolloftv.com',
  'africanmoviedb.com',
  'vhx.imgix.net',
  'm.media-amazon.com',
  'nflxso.net',
  'images.mubicdn.net',
  'bakkaz-files',
  '1s8yfxw74q.ufs.sh',
  'i.ytimg.com',
];

function getFilenameFor(title: string, id: string): string {
  return `${id.slice(0, 8)}-${(title || 'film').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).end();

  if (!(await isValidAuth(req)).valid) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const BATCH = 50;
  const stats = { processed: 0, mirrored: 0, failed: 0, nulled: 0 };

  // Fetch films that still have external poster URLs
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url')
    .not('poster_url', 'is', null)
    .neq('poster_url', '')
    .not('poster_url', 'ilike', '%supabase.co%')
    .not('poster_url', 'ilike', '%muvidb.com/media%')
    .not('poster_url', 'ilike', '%image.tmdb.org%')
    .order('created_at', { ascending: false })
    .limit(BATCH);

  if (error) {
    console.error('[cron/mirror-images] DB error:', error.message);
    return res.status(500).json({ error: error.message });
  }

  if (!films || films.length === 0) {
    return res.json({ message: 'Nothing to mirror — all images already hosted on our storage.', ...stats });
  }

  // Sort: worst domains first
  films.sort((a, b) => {
    const pri = (url: string | null) => {
      if (!url) return 999;
      const idx = PRIORITY_DOMAINS.findIndex(d => url.includes(d));
      return idx === -1 ? 500 : idx;
    };
    return pri(a.poster_url) - pri(b.poster_url);
  });

  for (const film of films) {
    stats.processed++;
    const domain = (() => { try { return new URL(film.poster_url!).hostname; } catch { return ''; } })();
    const isBlocked = NULL_ON_FAIL_DOMAINS.some(d => domain.includes(d));

    if (isBlocked) {
      await supabase.from('films').update({ poster_url: null }).eq('id', film.id);
      stats.nulled++;
      continue;
    }

    const filename = getFilenameFor(film.title, film.id);
    const mirrored = await mirrorImageToStorage(film.poster_url, 'posters', filename);

    if (mirrored) {
      // Mirror backdrop too if it's from the same bad domain
      let newBackdrop = film.backdrop_url;
      if (film.backdrop_url && !isOwnUrl(film.backdrop_url) && film.backdrop_url !== film.poster_url) {
        newBackdrop = await mirrorImageToStorage(film.backdrop_url, 'backdrops', `${filename}-bd`) ?? film.backdrop_url;
      } else if (film.backdrop_url === film.poster_url) {
        newBackdrop = mirrored; // same image, reuse mirrored URL
      }

      await supabase.from('films').update({
        poster_url: mirrored,
        ...(newBackdrop !== film.backdrop_url ? { backdrop_url: newBackdrop } : {}),
      }).eq('id', film.id);

      stats.mirrored++;
    } else {
      stats.failed++;
    }
  }

  console.log(`[cron/mirror-images] Done: ${JSON.stringify(stats)}`);
  return res.json({
    message: `Mirrored ${stats.mirrored}/${stats.processed} film images to Supabase Storage.`,
    ...stats,
  });
}
