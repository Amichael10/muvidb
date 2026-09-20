import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Load strictly portrait datasets
const nollywoodPortrait = JSON.parse(fs.readFileSync('scratch/nollywood_strictly_portrait.json', 'utf-8'));
const nollywirePortrait = JSON.parse(fs.readFileSync('scratch/nollywire_strictly_portrait.json', 'utf-8'));
const allDbFilms = JSON.parse(fs.readFileSync('scratch/db_movies_for_backfill.json', 'utf-8'));

// Build exemption set
const EXEMPT_CHANNEL_IDS = new Set([
  '42caa240-b1bc-440b-a2c1-c65013cf2bad', // Itele TV
  'b01a1d05-da1b-43fd-9f14-c4ea2723f8ec'  // Toyin Abraham TV
]);

const exemptDbIds = new Set();
for (const f of allDbFilms) {
  if (f.is_exempt || EXEMPT_CHANNEL_IDS.has(f.channel_id)) {
    exemptDbIds.add(f.id);
  }
}

console.log(`Exempt film IDs in DB: ${exemptDbIds.size}`);

// Prepare final updates map by film id
const finalUpdates = new Map();

// 1. Add Nollywood.com 1600px portrait posters (highest quality)
for (const item of nollywoodPortrait) {
  if (exemptDbIds.has(item.db_id)) {
    console.log(`[SKIP EXEMPT] Nollywood: ${item.title}`);
    continue;
  }
  finalUpdates.set(item.db_id, {
    film_id: item.db_id,
    title: item.title,
    year: item.year,
    source: 'nollywood.com (1600px HD)',
    new_poster_url: item.nollywood_poster_url,
    dims: `${item.dims.width}x${item.dims.height}`
  });
}

// 2. Add Nollywire portrait posters (if not already covered by Nollywood or if Nollywire is unique)
for (const item of nollywirePortrait) {
  const dbId = item.db_id;
  if (exemptDbIds.has(dbId)) {
    console.log(`[SKIP EXEMPT] Nollywire: ${item.db_title}`);
    continue;
  }
  if (!finalUpdates.has(dbId)) {
    finalUpdates.set(dbId, {
      film_id: dbId,
      title: item.db_title,
      year: item.db_year,
      source: 'nollywire.com (Portrait)',
      new_poster_url: item.nollywire_poster,
      dims: `${item.dims.width}x${item.dims.height}`
    });
  }
}

console.log(`\nTotal verified portrait upgrades to apply: ${finalUpdates.size}`);

async function execute() {
  const updateList = Array.from(finalUpdates.values());
  const ids = updateList.map(u => u.film_id);

  // Fetch current live DB records for backup
  const { data: currentRecords, error: fetchErr } = await supabase
    .from('films')
    .select('id, title, year, poster_url, backdrop_url')
    .in('id', ids);

  if (fetchErr) {
    console.error('Failed to fetch backup records:', fetchErr);
    return;
  }

  fs.writeFileSync('scratch/pre_verified_portrait_upgrades_backup.json', JSON.stringify(currentRecords, null, 2));
  console.log(`Saved backup of ${currentRecords.length} records to scratch/pre_verified_portrait_upgrades_backup.json`);

  // Apply updates
  let successCount = 0;
  let failCount = 0;

  for (const u of updateList) {
    // Only update poster_url, NEVER touch backdrop_url
    const { error: updateErr } = await supabase
      .from('films')
      .update({ poster_url: u.new_poster_url })
      .eq('id', u.film_id);

    if (updateErr) {
      console.error(`Failed to update "${u.title}":`, updateErr.message);
      failCount++;
    } else {
      console.log(`[SUCCESS] "${u.title}" (${u.dims}) <- ${u.source}`);
      successCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`✅ UPGRADE COMPLETE`);
  console.log(`Successful upgrades: ${successCount}`);
  console.log(`Failed upgrades:     ${failCount}`);
  console.log(`========================================`);

  fs.writeFileSync('scratch/applied_verified_portrait_upgrades.json', JSON.stringify(updateList, null, 2));
}

execute();
