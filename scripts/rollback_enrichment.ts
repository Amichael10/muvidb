/**
 * rollback_enrichment.ts
 * ----------------------
 * Deletes all films created by full_catalog_enrichment + their credits.
 * Reads the pre-classified list OR defaults to source='full_catalog_enrichment'.
 *
 * Usage:
 *   npx tsx scripts/rollback_enrichment.ts               -- deletes all 619
 *   npx tsx scripts/rollback_enrichment.ts --from-file   -- deletes only IDs in scratch/enrichment_delete_ids.json
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const sb = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHUNK = 50;

async function deleteInChunks(ids: string[], table: string, column: string, label: string) {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const { error } = await sb.from(table).delete().in(column, chunk);
    if (error) {
      console.error(`  ✗ Error deleting ${label} chunk ${i}-${i + CHUNK}:`, error.message);
    } else {
      deleted += chunk.length;
      process.stdout.write(`\r  ⟳ ${label}: ${deleted}/${ids.length} deleted...`);
    }
  }
  console.log(`\n  ✅ ${label}: ${deleted} deleted.`);
  return deleted;
}

async function run() {
  const fromFile = process.argv.includes('--from-file');

  let filmIds: string[] = [];

  if (fromFile) {
    const filePath = path.resolve('scratch/enrichment_delete_ids.json');
    if (!fs.existsSync(filePath)) {
      console.error('❌ scratch/enrichment_delete_ids.json not found. Run audit_enrichment.ts first.');
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    filmIds = data.ids;
    console.log(`\n📋 Loaded ${filmIds.length} IDs from file.`);
  } else {
    // Fetch all films with source=full_catalog_enrichment
    console.log('\n🔍 Fetching all full_catalog_enrichment films from DB...');
    let page = 0;
    while (true) {
      const { data, error } = await sb
        .from('films')
        .select('id')
        .eq('source', 'full_catalog_enrichment')
        .range(page * 500, (page + 1) * 500 - 1);
      if (error) { console.error(error.message); break; }
      if (!data?.length) break;
      filmIds = filmIds.concat(data.map(f => f.id));
      if (data.length < 500) break;
      page++;
    }
    console.log(`Found ${filmIds.length} films to delete.`);
  }

  if (filmIds.length === 0) {
    console.log('✅ Nothing to delete.');
    return;
  }

  console.log('\n⚠️  About to delete:');
  console.log(`   - ${filmIds.length} films (source=full_catalog_enrichment)`);
  console.log(`   - All their credits`);
  console.log(`   - All their film_genres rows`);
  console.log(`   - All their channel_videos links (film_id set to null)`);
  console.log('\nStarting in 3 seconds... (Ctrl+C to abort)\n');

  await new Promise(r => setTimeout(r, 3000));

  // Step 1: Delete credits first (FK constraint)
  console.log('Step 1/4: Deleting credits...');
  await deleteInChunks(filmIds, 'credits', 'film_id', 'credits');

  // Step 2: Delete film_genres
  console.log('Step 2/4: Deleting film_genres...');
  await deleteInChunks(filmIds, 'film_genres', 'film_id', 'film_genres');

  // Step 3: Null out channel_videos.film_id (don't delete the video record, just unlink)
  console.log('Step 3/4: Unlinking channel_videos...');
  for (let i = 0; i < filmIds.length; i += CHUNK) {
    const chunk = filmIds.slice(i, i + CHUNK);
    await sb.from('channel_videos').update({ film_id: null }).in('film_id', chunk);
  }
  console.log('  ✅ channel_videos unlinked.');

  // Step 4: Delete the films themselves
  console.log('Step 4/4: Deleting films...');
  await deleteInChunks(filmIds, 'films', 'id', 'films');

  console.log('\n══════════════════════════════════════════');
  console.log(`🎉 ROLLBACK COMPLETE`);
  console.log(`   ${filmIds.length} enrichment films removed from DB.`);
  console.log('══════════════════════════════════════════\n');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
