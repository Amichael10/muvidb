import { supabase } from '../api/_lib/supabase.ts';
import fs from 'fs';

async function retryOp<T>(op: () => Promise<T>, maxRetries = 3, label = 'op'): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await op();
    } catch (err: any) {
      if (i === maxRetries - 1) throw err;
      console.log(`[Retry ${i + 1}/${maxRetries}] ${label}: ${err.message || err}`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(`Failed ${label} after ${maxRetries} retries`);
}

async function deleteEmptyShells() {
  console.log('--- STARTING DELETION OF 486 EMPTY SHELLS ---');

  const progress = JSON.parse(fs.readFileSync('unattached_films_resolved_progress.json', 'utf8'));
  const deadOrPrivate = progress.filter((item: any) =>
    item.status === 'unavailable' || item.resolved_channel === 'Video Unavailable / Private'
  );

  console.log(`Found ${deadOrPrivate.length} total dead/private video entries.`);
  const deadIds = deadOrPrivate.map((d: any) => d.id);

  // 1. Identify which ones actually have 0 credits
  const CHUNK_SIZE = 50;
  const filmsWithCreditsSet = new Set<string>();

  for (let i = 0; i < deadIds.length; i += CHUNK_SIZE) {
    const chunk = deadIds.slice(i, i + CHUNK_SIZE);
    await retryOp(async () => {
      const { data: credits, error } = await supabase
        .from('credits')
        .select('film_id')
        .in('film_id', chunk);
      if (error) throw error;
      credits?.forEach((c: any) => filmsWithCreditsSet.add(c.film_id));
    }, 3, 'Fetch credits for dead films');
  }

  const emptyShells = deadOrPrivate.filter((d: any) => !filmsWithCreditsSet.has(d.id));
  console.log(`Verified ${emptyShells.length} empty shells with NO cast/crew in DB.`);

  const shellIds = emptyShells.map((s: any) => s.id);
  let totalDeletedFilms = 0;

  // 2. Delete empty shells in chunks
  for (let i = 0; i < shellIds.length; i += CHUNK_SIZE) {
    const chunk = shellIds.slice(i, i + CHUNK_SIZE);

    await retryOp(async () => {
      // Clear all child relations / foreign keys
      await Promise.allSettled([
        supabase.from('pending_cinema_films').update({ promoted_film_id: null }).in('promoted_film_id', chunk),
        supabase.from('pending_cinema_films').delete().in('promoted_film_id', chunk),
        supabase.from('film_genres').delete().in('film_id', chunk),
        supabase.from('film_companies').delete().in('film_id', chunk),
        supabase.from('reviews').delete().in('film_id', chunk),
        supabase.from('box_office_records').delete().in('film_id', chunk),
        supabase.from('comments').delete().in('film_id', chunk),
        supabase.from('showtimes').delete().in('film_id', chunk),
        supabase.from('channel_videos').delete().in('film_id', chunk),
        supabase.from('social_content_items').delete().in('film_id', chunk),
        supabase.from('watchlist').delete().in('film_id', chunk),
        supabase.from('user_favorites').delete().in('film_id', chunk),
        supabase.from('film_sync_logs').delete().in('film_id', chunk),
        supabase.from('screenplay_analyses').delete().in('film_id', chunk),
      ]);

      // Delete from films
      const { count: fCount, error: fErr } = await supabase
        .from('films')
        .delete({ count: 'exact' })
        .in('id', chunk);

      if (fErr) throw fErr;
      if (fCount) totalDeletedFilms += fCount;
    }, 3, `Delete empty shells chunk ${i}`);

    console.log(`Deleted ${totalDeletedFilms} / ${shellIds.length} empty shells...`);
  }

  console.log(`\n=== COMPLETED! Successfully deleted ${totalDeletedFilms} empty shell films ===`);
}

deleteEmptyShells().catch(console.error);
