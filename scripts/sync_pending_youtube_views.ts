import './lib/db.js';
import { supabase } from './lib/db.js';
import { ytGet } from '../api/_lib/yt_service.js';

async function fetchPendingFilms(): Promise<{ id: string; title: string; source_video_id: string; view_count: number | null }[]> {
  const all: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, source_video_id, view_count')
      .not('source_video_id', 'is', null)
      .or('view_count.is.null,view_count.eq.0')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching pending films:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

async function updateViewsInBatch(updates: { id: string; view_count: number }[]) {
  if (!updates.length) return;
  const CONCURRENCY = 5;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const slice = updates.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(u => supabase.from('films').update({ view_count: u.view_count }).eq('id', u.id))
    );
    await new Promise(r => setTimeout(r, 20));
  }
}

async function main() {
  console.log('=== SYNCING PENDING YOUTUBE VIEW COUNTS ===\n');

  console.log('Fetching films with 0 or NULL views...');
  const films = await fetchPendingFilms();
  console.log(`Found ${films.length} films to update.\n`);

  if (films.length === 0) {
    console.log('No pending films to update!');
    return;
  }

  const BATCH_SIZE = 50;
  let updatedCount = 0;
  let missingCount = 0;
  const totalBatches = Math.ceil(films.length / BATCH_SIZE);

  for (let b = 0; b < totalBatches; b++) {
    const chunk = films.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const videoIds = chunk.map(f => f.source_video_id);
    const filmMap = new Map(chunk.map(f => [f.source_video_id, f]));

    try {
      const res = await ytGet('videos', {
        part: 'statistics',
        id: videoIds.join(','),
      });

      const items = res.items || [];
      const returnedIds = new Set(items.map((it: any) => it.id));
      const pendingUpdates: { id: string; view_count: number }[] = [];

      for (const item of items) {
        const vid = item.id;
        const newViews = Number(item.statistics?.viewCount || 0);
        const film = filmMap.get(vid);
        if (film && newViews > 0) {
          pendingUpdates.push({ id: film.id, view_count: newViews });
        }
      }

      if (pendingUpdates.length > 0) {
        await updateViewsInBatch(pendingUpdates);
        updatedCount += pendingUpdates.length;
      }

      for (const vid of videoIds) {
        if (!returnedIds.has(vid)) missingCount++;
      }
    } catch (err: any) {
      console.warn(`[Batch ${b + 1}/${totalBatches}] error:`, err.message);
    }

    if ((b + 1) % 5 === 0 || b === totalBatches - 1) {
      const processed = Math.min((b + 1) * BATCH_SIZE, films.length);
      const pct = Math.round((processed / films.length) * 100);
      console.log(`Progress: [${processed}/${films.length}] (${pct}%) — Updated: ${updatedCount}, Unavailable: ${missingCount}`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\nSync finished! Updated views for ${updatedCount} films (${missingCount} unavailable on YouTube).`);
}

main().catch(console.error);
