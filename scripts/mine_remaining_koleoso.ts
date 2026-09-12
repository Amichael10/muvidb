import './lib/db.js';
import { supabase } from './lib/db.js';
import { mineFilmComments } from '../api/_lib/comment_reviews.js';

async function run() {
  console.log('Fetching Koleoso films needing comments/ratings...');
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, source_video_id, audience_rating, liked_percent')
    .or('title.ilike.Koleoso%,title.ilike.Osodiran%')
    .is('audience_rating', null)
    .order('title');

  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  console.log(`Found ${films.length} films pending comments/ratings.`);

  for (const f of films) {
    if (!f.source_video_id) {
      console.log(`Skipping "${f.title}" (no video ID)`);
      continue;
    }
    console.log(`Mining comments for: "${f.title}" (${f.source_video_id})...`);
    try {
      const res = await mineFilmComments(f.id, f.source_video_id, { maxKeep: 10 });
      console.log(`  -> Result:`, JSON.stringify(res));
    } catch (e: any) {
      console.error(`  -> Error:`, e.message);
    }
    // slight delay to respect rate limits
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log('\n--- ALL KOLEOSO FILMS STATUS ---');
  const { data: all } = await supabase
    .from('films')
    .select('title, view_count, audience_rating, liked_percent')
    .or('title.ilike.Koleoso%,title.ilike.Osodiran%')
    .order('title');

  let totalViews = 0;
  for (const f of all || []) {
    console.log(
      f.title.padEnd(42) + ' | ' +
      String(f.view_count?.toLocaleString() || '0').padStart(11) + ' views | ' +
      'rating: ' + String(f.audience_rating ?? '—').padStart(4) + ' | ' +
      'liked: ' + String(f.liked_percent ? f.liked_percent + '%' : '—').padStart(5)
    );
    totalViews += (f.view_count || 0);
  }
  console.log('---------------------------------------------------------------------------------');
  console.log('TOTAL VIEWS:', totalViews.toLocaleString());
}

run().catch(console.error);
