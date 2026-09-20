import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co').trim();
const serviceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

if (!url || !serviceKey) {
  console.error('Missing Supabase credentials!');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false }
});

async function main() {
  console.log('🚀 Loading backfill candidates...');
  const candidates = JSON.parse(fs.readFileSync('scratch/all_candidates_for_backfill.json', 'utf8'));
  console.log(`Loaded ${candidates.length} candidate films for poster backfill.`);

  // 1. Safety verification: Double-check exempt channels
  console.log('Verifying exempt channels (Itele TV & Toyin Abraham TV)...');
  const { data: exemptChannels } = await supabase
    .from('channels')
    .select('id, name, channel_handle')
    .or('name.ilike.%itele%,name.ilike.%toyin%,name.ilike.%abraham%,channel_handle.ilike.%itele%,channel_handle.ilike.%toyin%,channel_handle.ilike.%abraham%');

  const exemptChannelIds = (exemptChannels || []).map(c => c.id);
  console.log(`Found ${exemptChannelIds.length} exempt channels:`, exemptChannels?.map(c => c.name));

  const { data: exemptVideos } = await supabase
    .from('channel_videos')
    .select('film_id')
    .in('channel_id', exemptChannelIds);

  const exemptFilmIds = new Set((exemptVideos || []).map(v => v.film_id).filter(Boolean));
  console.log(`Total exempt film IDs: ${exemptFilmIds.size}`);

  const safeList = candidates.filter(c => !exemptFilmIds.has(c.db_id));
  console.log(`Safe list after live exemption check: ${safeList.length} films (should be ${candidates.length}).`);

  // 2. Save rollback backup
  const backupRecords = safeList.map(c => ({
    film_id: c.db_id,
    title: c.title,
    year: c.year,
    previous_poster_url: c.current_poster,
    new_poster_url: c.new_poster,
    nolly_title: c.nolly_title,
    timestamp: new Date().toISOString()
  }));

  fs.writeFileSync('scratch/pre_backfill_posters_backup.json', JSON.stringify(backupRecords, null, 2));
  console.log(`✅ Saved backup to scratch/pre_backfill_posters_backup.json (${backupRecords.length} records).`);

  // 3. Apply updates in batches
  // Note: Only updating poster_url. backdrop_url is never touched.
  const BATCH_SIZE = 25;
  let successCount = 0;
  let failCount = 0;
  const errors = [];

  console.log(`\nBeginning database updates across ${Math.ceil(safeList.length / BATCH_SIZE)} batches...`);

  for (let i = 0; i < safeList.length; i += BATCH_SIZE) {
    const chunk = safeList.slice(i, i + BATCH_SIZE);
    const promises = chunk.map(item =>
      supabase
        .from('films')
        .update({ poster_url: item.new_poster })
        .eq('id', item.db_id)
    );

    const results = await Promise.all(promises);
    for (let j = 0; j < results.length; j++) {
      if (results[j].error) {
        failCount++;
        errors.push({ id: chunk[j].db_id, title: chunk[j].title, error: results[j].error });
      } else {
        successCount++;
      }
    }

    if ((i + BATCH_SIZE) % 250 === 0 || i + BATCH_SIZE >= safeList.length) {
      console.log(`Progress: ${Math.min(i + BATCH_SIZE, safeList.length)}/${safeList.length} updated (Success: ${successCount}, Failed: ${failCount})`);
    }
  }

  console.log('\n=============================================');
  console.log(' BACKFILL EXECUTION COMPLETE');
  console.log(` Successfully updated: ${successCount} posters`);
  console.log(` Failed: ${failCount}`);
  if (errors.length > 0) {
    console.log(' Errors sample:', errors.slice(0, 5));
  }
  console.log('=============================================');
}

main().catch(console.error);
