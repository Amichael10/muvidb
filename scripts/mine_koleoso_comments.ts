import './lib/db.js';
import { supabase } from './lib/db.js';
import { mineFilmComments } from '../api/_lib/comment_reviews.js';

async function run() {
  console.log('Fetching Koleoso & Osodiran films...');
  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, source_video_id, audience_rating, liked_percent')
    .or('title.ilike.Koleoso%,title.ilike.Osodiran%')
    .order('title');

  if (error) {
    console.error('Error fetching films:', error);
    return;
  }

  if (!films || films.length === 0) {
    console.log('No films found matching Koleoso or Osodiran.');
    return;
  }

  console.log(`Found ${films.length} films to mine comments for:`);

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
    // slight delay between AI calls
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log('\n--- VERIFYING FINAL SCORES IN DB ---');
  const { data: updated } = await supabase
    .from('films')
    .select('title, audience_rating, liked_percent, view_count')
    .or('title.ilike.Koleoso%,title.ilike.Osodiran%')
    .order('title');

  for (const u of updated || []) {
    console.log(
      u.title.padEnd(42),
      '| Views:', String(u.view_count?.toLocaleString()).padStart(12),
      '| Rating:', String(u.audience_rating ?? '—').padStart(4),
      '| Liked:', String(u.liked_percent ? `${u.liked_percent}%` : '—').padStart(5)
    );
  }
}

run().catch(console.error);
