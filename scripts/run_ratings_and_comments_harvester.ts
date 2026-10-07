import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';
import { runCommentMining } from '../api/_lib/comment_reviews.js';
import { ytGet } from '../api/_lib/yt_service.js';
import { pctLiked, score10FromLikedPercent } from '../api/_lib/rating.js';

const db = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function main() {
  console.log('=== STARTING RATING & COMMENT HARVESTER ===\n');

  // STEP 1: Find recent films (especially new YouTube ones)
  console.log('1. Scanning recent and unrated films...');
  const { data: recentFilms, error: rErr } = await db
    .from('films')
    .select('id, title, source_video_id, source, view_count, audience_rating, liked_percent, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (rErr) {
    console.error('Error fetching recent films:', rErr);
  } else {
    console.log(`Found ${recentFilms?.length || 0} recent films.`);
    const ytCount = (recentFilms || []).filter(f => f.source_video_id).length;
    console.log(`  -> ${ytCount} of these have YouTube video IDs.`);
  }

  // STEP 2: Quick YouTube statistics sync for newly added YouTube films
  console.log('\n2. Updating YouTube statistics for new/unviewed YouTube videos...');
  const { data: unviewedYt } = await db
    .from('films')
    .select('id, title, source_video_id, view_count')
    .not('source_video_id', 'is', null)
    .or('view_count.is.null,view_count.eq.0')
    .order('created_at', { ascending: false })
    .limit(100);

  if (unviewedYt && unviewedYt.length > 0) {
    console.log(`Updating view counts for ${unviewedYt.length} new/pending YouTube videos...`);
    for (let i = 0; i < unviewedYt.length; i += 50) {
      const chunk = unviewedYt.slice(i, i + 50);
      const vids = chunk.map(f => f.source_video_id).join(',');
      try {
        const stats = await ytGet('videos', { part: 'statistics', id: vids });
        const items = stats.items || [];
        for (const item of items) {
          const views = Number(item.statistics?.viewCount || 0);
          const matched = chunk.find(f => f.source_video_id === item.id);
          if (matched && views > 0) {
            await db.from('films').update({ view_count: views }).eq('id', matched.id);
            console.log(`  Updated "${matched.title}": ${views.toLocaleString()} views`);
          }
        }
      } catch (err: any) {
        console.warn('  YouTube stats fetch warning:', err.message);
      }
    }
  } else {
    console.log('No pending unviewed YouTube films found.');
  }

  // STEP 3: Run comment mining & sentiment rating harvester
  console.log('\n3. Running YouTube Comment Mining & Rating Harvester...');
  try {
    const miningResult = await runCommentMining({ scan: 60, aiCap: 25 });
    console.log('Mining result:', JSON.stringify(miningResult, null, 2));
  } catch (err: any) {
    console.error('Comment mining error:', err.message);
  }

  // STEP 4: Reconcile ratings for all recent films (TMDB / IMDb / audience -> liked_percent)
  console.log('\n4. Reconciling ratings across catalog...');
  const { data: needsRating } = await db
    .from('films')
    .select('id, title, liked_percent, imdb_rating, tmdb_rating, audience_rating, audience_rating_count')
    .or('liked_percent.is.null,imdb_rating.is.null')
    .limit(200);

  let reconciledCount = 0;
  if (needsRating && needsRating.length > 0) {
    for (const film of needsRating) {
      const updates: Record<string, any> = {};
      let currentLiked = film.liked_percent;
      let currentImdb = film.imdb_rating ? Number(film.imdb_rating) : null;
      let currentTmdb = film.tmdb_rating ? Number(film.tmdb_rating) : null;
      let currentAudience = film.audience_rating ? Number(film.audience_rating) : null;

      const bestStar = currentImdb || currentTmdb || currentAudience;
      if (currentLiked == null && bestStar != null && bestStar > 0) {
        currentLiked = pctLiked(bestStar);
        updates.liked_percent = currentLiked;
      }

      if (currentImdb == null && currentLiked != null && currentLiked > 0) {
        currentImdb = score10FromLikedPercent(currentLiked);
        updates.imdb_rating = currentImdb;
      }

      if (Object.keys(updates).length > 0) {
        await db.from('films').update(updates).eq('id', film.id);
        reconciledCount++;
      }
    }
    console.log(`Reconciled ratings for ${reconciledCount} films.`);
  }

  console.log('\n=== RATING & COMMENT HARVESTER COMPLETED ===');
}

main().catch(console.error);
