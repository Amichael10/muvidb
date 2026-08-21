import { supabase } from './lib/db';
import { pctLiked, score10FromLikedPercent } from '../api/_lib/rating';

async function main() {
  console.log('=== Starting full database backfill & seed across all 30k+ films ===');

  let lastId = '00000000-0000-0000-0000-000000000000';
  const pageSize = 500;
  let totalProcessed = 0;
  let totalUpdated = 0;
  const startTime = Date.now();

  while (true) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id, title, slug, release_type, streaming_links, liked_percent, imdb_rating, tmdb_rating, audience_rating, audience_rating_count')
      .gt('id', lastId)
      .order('id', { ascending: true })
      .limit(pageSize);

    if (error) {
      console.error(`Error fetching batch after ${lastId}:`, error.message);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    if (!films || films.length === 0) {
      console.log('No more films to process. Reached end of catalog!');
      break;
    }

    lastId = films[films.length - 1].id;

    const updatesBatch: { id: string; updates: Record<string, any> }[] = [];

    for (const film of films) {
      totalProcessed++;
      const updates: Record<string, any> = {};

      let currentLiked = film.liked_percent;
      let currentImdb = film.imdb_rating ? Number(film.imdb_rating) : null;
      let currentTmdb = film.tmdb_rating ? Number(film.tmdb_rating) : null;
      let currentAudience = film.audience_rating ? Number(film.audience_rating) : null;

      // 1. Existing external score -> liked_percent
      const bestStar = currentImdb || currentTmdb || currentAudience;
      if (currentLiked == null && bestStar != null && bestStar > 0) {
        currentLiked = pctLiked(bestStar);
        updates.liked_percent = currentLiked;
      }

      // 2. Existing liked_percent -> imdb_rating
      if (currentImdb == null && currentLiked != null && currentLiked > 0) {
        currentImdb = score10FromLikedPercent(currentLiked);
        updates.imdb_rating = currentImdb;
        updates.imdb_vote_count = film.audience_rating_count || 120;
      }

      // 3. Unrated films remain unrated (null) until verified ratings or comments exist

      if (Object.keys(updates).length > 0) {
        updatesBatch.push({ id: film.id, updates });
      }
    }

    // Execute batch concurrently in chunks of 50
    const chunkSize = 50;
    for (let i = 0; i < updatesBatch.length; i += chunkSize) {
      const chunk = updatesBatch.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async ({ id, updates }) => {
          const { error: updErr } = await supabase
            .from('films')
            .update(updates)
            .eq('id', id);
          if (!updErr) {
            totalUpdated++;
          }
        })
      );
    }

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Batch] Total Processed: ${totalProcessed} (${totalUpdated} updated) in ${elapsedSec}s...`);
  }

  const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Seeding Finished ===`);
  console.log(`Total Films Processed: ${totalProcessed}`);
  console.log(`Total Films Updated: ${totalUpdated}`);
  console.log(`Total Time: ${totalSec}s`);
}

main().catch((err) => {
  console.error('Fatal error in seed runner:', err);
  process.exit(1);
});
