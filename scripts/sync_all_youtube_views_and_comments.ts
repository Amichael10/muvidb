import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { ytGet } from '../api/_lib/yt_service.js';
import { mineFilmComments, runCommentMining } from '../api/_lib/comment_reviews.js';

const db = createClient(process.env.SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

async function fetchAllYouTubeFilms(): Promise<{ id: string; title: string; source_video_id: string; view_count: number | null }[]> {
  const all: any[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('films')
      .select('id, title, source_video_id, view_count')
      .not('source_video_id', 'is', null)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error fetching films batch:', error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
  }
  return all;
}

async function ytGetWithRetry(endpoint: string, params: Record<string, string>, retries = 3): Promise<any> {
  for (let r = 0; r < retries; r++) {
    try {
      return await ytGet(endpoint, params);
    } catch (e: any) {
      if (r === retries - 1) throw e;
      await new Promise(res => setTimeout(res, 500 * (r + 1)));
    }
  }
}

async function updateViewsInBatch(updates: { id: string; view_count: number }[]) {
  if (!updates.length) return;
  const CONCURRENCY = 20;
  for (let i = 0; i < updates.length; i += CONCURRENCY) {
    const slice = updates.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(u => db.from('films').update({ view_count: u.view_count }).eq('id', u.id))
    );
  }
}

async function main() {
  console.log('=== STARTING COMPLETE YOUTUBE VIEWS & COMMENTS SYNC ===\n');

  // STEP 1: Fetch all films with YouTube video IDs
  console.log('Fetching all films with YouTube video IDs from database...');
  const films = await fetchAllYouTubeFilms();
  console.log(`Found ${films.length} films with YouTube video IDs.\n`);

  // STEP 2: Process sequentially in batches of 50
  const BATCH_SIZE = 50;
  let updatedCount = 0;
  let missingVideosCount = 0;

  console.log(`--- PHASE 1: Syncing YouTube view counts in batches of ${BATCH_SIZE} ---`);
  const totalBatches = Math.ceil(films.length / BATCH_SIZE);

  for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
    const start = batchIdx * BATCH_SIZE;
    const chunk = films.slice(start, start + BATCH_SIZE);
    const idMap = new Map(chunk.map(f => [f.source_video_id, f]));
    const videoIds = chunk.map(f => f.source_video_id);

    try {
      const res = await ytGetWithRetry('videos', {
        part: 'statistics',
        id: videoIds.join(','),
      });

      const returnedItems = res.items || [];
      const returnedSet = new Set(returnedItems.map((item: any) => item.id));

      const pendingUpdates: { id: string; view_count: number }[] = [];
      for (const item of returnedItems) {
        const vid = item.id;
        const newViews = Number(item.statistics?.viewCount || 0);
        const film = idMap.get(vid);

        if (film && film.view_count !== newViews) {
          pendingUpdates.push({ id: film.id, view_count: newViews });
        }
      }

      if (pendingUpdates.length > 0) {
        await updateViewsInBatch(pendingUpdates);
        updatedCount += pendingUpdates.length;
      }

      for (const vid of videoIds) {
        if (!returnedSet.has(vid)) missingVideosCount++;
      }
    } catch (err: any) {
      console.warn(`[Batch ${batchIdx + 1}/${totalBatches}] error: ${err.message}`);
    }

    if ((batchIdx + 1) % 10 === 0 || batchIdx === totalBatches - 1) {
      const processed = Math.min((batchIdx + 1) * BATCH_SIZE, films.length);
      const pct = Math.round((processed / films.length) * 100);
      console.log(`[${processed}/${films.length}] (${pct}%) — ${updatedCount} views updated (${missingVideosCount} unavailable)`);
    }

    // Gentle pacing between YouTube API calls
    await new Promise(r => setTimeout(r, 60));
  }

  console.log(`\nPhase 1 complete! Updated views on ${updatedCount} films.`);

  // STEP 3: Mine comments for all Koleoso & Osodiran films
  console.log('\n--- PHASE 2: Mining Audience Comments for Koleoso & Osodiran Franchise ---');
  const { data: koleosoFilms } = await db
    .from('films')
    .select('id, title, source_video_id, view_count, audience_rating')
    .or('title.ilike.Koleoso%,title.ilike.Osodiran%')
    .order('title', { ascending: true });

  for (const k of koleosoFilms || []) {
    if (!k.source_video_id) continue;
    try {
      console.log(`Mining comments for: "${k.title}" (${k.source_video_id})...`);
      const mineRes = await mineFilmComments(k.id, k.source_video_id, { maxKeep: 10 });
      if (mineRes.status === 'ok') {
        console.log(`  -> Kept ${mineRes.kept} comments | Rating: ${mineRes.rating}/10 | Liked: ${mineRes.likedPercent}%`);
      } else {
        console.log(`  -> Skipped (${mineRes.reason})`);
      }
    } catch (e: any) {
      console.warn(`  -> Error mining ${k.title}: ${e.message}`);
    }
  }

  // STEP 4: General comment mining sweep on top-viewed unmined films
  console.log('\n--- PHASE 3: Running general comment mining sweep for top unmined films ---');
  try {
    const sweepRes = await runCommentMining({ scan: 50, aiCap: 25 });
    console.log('Comment sweep result:', sweepRes);
  } catch (e: any) {
    console.warn('Comment sweep error:', e.message);
  }

  // STEP 5: Final stats check for Koleoso ecosystem
  console.log('\n=== FINAL KOLEOSO & OSODIRAN ECOSYSTEM SUMMARY ===');
  const { data: finalKoleoso } = await db
    .from('films')
    .select('title, view_count, audience_rating, liked_percent, source_video_id')
    .or('title.ilike.Koleoso%,title.ilike.Osodiran%')
    .order('title', { ascending: true });

  let totalEcosystemViews = 0;
  for (const f of finalKoleoso || []) {
    console.log(
      f.title.padEnd(45),
      '| Views:', String(Number(f.view_count || 0).toLocaleString()).padStart(12),
      '| Rating:', String(f.audience_rating ?? '—').padStart(4),
      '| Liked:', String(f.liked_percent ? `${f.liked_percent}%` : '—').padStart(5)
    );
    totalEcosystemViews += Number(f.view_count || 0);
  }
  console.log('-------------------------------------------------------------------------------');
  console.log('TOTAL KOLEOSO & OSODIRAN ECOSYSTEM VIEWS:', totalEcosystemViews.toLocaleString());
  console.log('\n=== ALL TASKS COMPLETED ===');
}

main().catch(console.error);
