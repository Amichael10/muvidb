import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function parallelDelete(table, column, ids, batchSize = 200, concurrency = 6) {
  let deleted = 0;
  const chunks = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }

  for (let i = 0; i < chunks.length; i += concurrency) {
    const concurrentChunks = chunks.slice(i, i + concurrency);
    const results = await Promise.all(
      concurrentChunks.map(chunk =>
        supabase.from(table).delete({ count: 'exact' }).in(column, chunk)
      )
    );
    for (const r of results) {
      if (!r.error && r.count) deleted += r.count;
    }
  }
  return deleted;
}

async function purgeZeroCreditPeople() {
  console.log('🧹 === SCANNING & PURGING PEOPLE WITH 0 CREDITS ===\n');

  // 1. Fetch all distinct person_ids that have active credits
  console.log('Step 1: Collecting all active person IDs from credits...');
  const activePersonIds = new Set();
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('credits')
      .select('person_id')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    data.forEach(c => {
      if (c.person_id) activePersonIds.add(c.person_id);
    });
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`Found ${activePersonIds.size} people with active credits in the database.`);

  // 2. Fetch channel owners to protect
  console.log('Step 2: Checking channel owners to preserve...');
  const protectedChannelOwners = new Set();
  const { data: channels } = await supabase.from('channels').select('owner_person_id').not('owner_person_id', 'is', null);
  (channels || []).forEach(ch => {
    if (ch.owner_person_id) protectedChannelOwners.add(ch.owner_person_id);
  });
  console.log(`Preserving ${protectedChannelOwners.size} channel owner star profiles.`);

  // 3. Load all people in the database
  console.log('Step 3: Loading all people records...');
  let allPeople = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, claimed_by')
      .range(from, from + PAGE_SIZE - 1);
    if (error || !data?.length) break;
    allPeople.push(...data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`Total people loaded: ${allPeople.length}`);

  // 4. Filter people with 0 credits
  const peopleToDelete = allPeople.filter(p => {
    if (p.claimed_by) return false; // keep claimed user profiles
    if (protectedChannelOwners.has(p.id)) return false; // keep designated channel stars
    return !activePersonIds.has(p.id); // has 0 credits
  });

  console.log(`\n======================================================`);
  console.log(`Total People in DB:          ${allPeople.length}`);
  console.log(`People with Valid Credits:   ${activePersonIds.size}`);
  console.log(`People with 0 Credits:       ${peopleToDelete.length}`);
  console.log(`======================================================\n`);

  if (peopleToDelete.length === 0) {
    console.log('✅ No 0-credit people found. Database is already clean!');
    return;
  }

  const idsToDelete = peopleToDelete.map(p => p.id);

  // 5. Delete child media & references
  console.log('Step 4: Cleaning up child media and auxiliary links...');
  await parallelDelete('person_media', 'person_id', idsToDelete, 250, 6);

  // 6. Delete the people records in fast parallel batches
  console.log(`Step 5: Deleting ${idsToDelete.length} people with 0 credits...`);
  const deletedCount = await parallelDelete('people', 'id', idsToDelete, 200, 6);
  console.log(` -> Successfully deleted ${deletedCount} people records.`);

  // 7. Verify final people count
  const { count: finalPeopleCount } = await supabase.from('people').select('*', { count: 'exact', head: true });
  console.log(`\n🎉 PURGE COMPLETE!`);
  console.log(`- Final People Count: ${finalPeopleCount}`);
  console.log(`======================================================\n`);
}

purgeZeroCreditPeople().catch(console.error);
