import { supabase } from './lib/db';

const NOISE_PEOPLE_NAMES = [
  'Pastor Bolaji',
  'Exec Producer Powered',
  'Nursefavour Chukwu',
  'Grâce Hillary Zossoungbo',
  'Set Somto Ibeh',
  'Set Thomas Isreal',
  'Tōru Murakawa',
  'Set Design',
  'Ogboluke Set',
  'Mcpc The Comedian',
  'Expatriate Comedian',
  'DADA OLUWASOLA OMOTOLAN! UCHE',
  'Senator the Comedian',
  'Uduakisong Itv',
  '26d Untt',
  'Concluding Part',
  'Coficluding Part',
  'OKIK] OLAMIL ERAN',
  'Brain Jotter Best Comedian',
  'Pastor Dag Edward Mlls'
];

async function main() {
  console.log('=== Cleaning Role Labels, Noise, Monikers, and Empty Orphans ===\n');

  // ==========================================
  // 1. DELETE ROLE LABELS / OCR NOISE
  // ==========================================
  console.log('--- 1. Purging Role Labels & OCR Noise ---');
  let deletedNoiseCount = 0;
  for (const noiseName of NOISE_PEOPLE_NAMES) {
    const { data: matches } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', noiseName);

    if (matches && matches.length > 0) {
      for (const m of matches) {
        // Check if has any credits
        const { count: credCount } = await supabase
          .from('credits')
          .select('id', { count: 'exact', head: true })
          .eq('person_id', m.id);

        if (credCount && credCount > 0) {
          console.log(`⚠️ Skipping "${m.name}" (${m.id}): has ${credCount} active credits`);
        } else {
          const { error: delErr } = await supabase.from('people').delete().eq('id', m.id);
          if (delErr) {
            console.error(`Error deleting "${m.name}":`, delErr.message);
          } else {
            console.log(`🗑️ Deleted noise record: "${m.name}" (${m.id})`);
            deletedNoiseCount++;
          }
        }
      }
    }
  }
  console.log(`Total role/OCR noise records deleted: ${deletedNoiseCount}\n`);

  // ==========================================
  // 2. PROCESS MONIKERS / SINGLE-WORD NAMES
  // ==========================================
  console.log('--- 2. Processing Single-Word / Moniker Names ---');
  // Check Brodashagi -> Broda Shaggi - Samuel Perry
  const realBrodaShaggiId = '4464a2b3-5f43-460a-b1da-1327599d848e';
  const { data: brodashagiMatches } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', 'Brodashagi');

  if (brodashagiMatches && brodashagiMatches.length > 0) {
    for (const b of brodashagiMatches) {
      // Check if it has any credits to rewire
      const { data: bCreds } = await supabase.from('credits').select('id, film_id, role').eq('person_id', b.id);
      if (bCreds && bCreds.length > 0) {
        console.log(`Rewiring ${bCreds.length} credits from Brodashagi to Broda Shaggi...`);
        for (const c of bCreds) {
          // Check if real Broda Shaggi already has credit on this film
          const { data: existing } = await supabase
            .from('credits')
            .select('id')
            .eq('film_id', c.film_id)
            .eq('person_id', realBrodaShaggiId)
            .eq('role', c.role)
            .limit(1);

          if (existing && existing.length > 0) {
            // Already credited, delete redundant credit
            await supabase.from('credits').delete().eq('id', c.id);
          } else {
            // Rewire credit
            await supabase.from('credits').update({ person_id: realBrodaShaggiId }).eq('id', c.id);
          }
        }
      }
      await supabase.from('people').delete().eq('id', b.id);
      console.log(`✓ Merged & deleted moniker "Brodashagi" (${b.id}) into Broda Shaggi - Samuel Perry`);
    }
  } else {
    console.log('No "Brodashagi" moniker found in people.');
  }

  // Check the other single-name monikers: Abiymo, Abiayamo, Osereme
  const otherMonikers = ['Abiymo', 'Abiayamo', 'Osereme'];
  for (const m of otherMonikers) {
    const { data } = await supabase.from('people').select('id, name, bio, photo_url').ilike('name', m);
    if (data && data.length > 0) {
      console.log(`ℹ️ Preserved moniker "${m}" (${data[0].id}) for user review (no verified 100% actor match found).`);
    }
  }
  console.log();

  // ==========================================
  // 3. PURGE EMPTY ORPHANED ZERO-CREDIT PEOPLE
  // ==========================================
  console.log('--- 3. Purging Empty Orphaned Zero-Credit Records ---');
  // First, fetch all people with film_count = 0 or null
  // In Supabase, limit is max 1000 per request, so paginate through
  let offset = 0;
  const pageSize = 500;
  let hasMore = true;
  let totalEvaluated = 0;
  let totalPreserved = 0;
  let deletedOrphansCount = 0;
  const idsToDelete: string[] = [];

  while (hasMore) {
    const { data: batch, error } = await supabase
      .from('people')
      .select('id, name, photo_url, bio, awards, tmdb_id, mubi_id, is_spotlight, is_verified, film_count')
      .or('film_count.is.null,film_count.eq.0')
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Error fetching batch:', error.message);
      break;
    }

    if (!batch || batch.length === 0) {
      hasMore = false;
      break;
    }

    totalEvaluated += batch.length;

    for (const p of batch) {
      // Don't delete protected monikers we intentionally kept
      if (otherMonikers.some(m => m.toLowerCase() === p.name.trim().toLowerCase())) {
        totalPreserved++;
        continue;
      }

      const hasPhoto = Boolean(p.photo_url && p.photo_url.trim().length > 0);
      const hasBio = Boolean(p.bio && p.bio.trim().length > 0);
      const hasAwards = Boolean(Array.isArray(p.awards) && p.awards.length > 0);
      const hasTmdb = Boolean(p.tmdb_id || p.mubi_id);
      const isSpecial = Boolean(p.is_spotlight || p.is_verified);

      if (hasPhoto || hasBio || hasAwards || hasTmdb || isSpecial) {
        totalPreserved++;
        continue;
      }

      // Verify that this person truly has 0 credits in credits table before scheduling delete
      idsToDelete.push(p.id);
    }

    offset += pageSize;
    if (batch.length < pageSize) {
      hasMore = false;
    }
  }

  console.log(`Evaluated ${totalEvaluated} records with film_count = 0/null.`);
  console.log(`Preserved ${totalPreserved} records because they have photos, bios, awards, or TMDb/MUBI data.`);
  console.log(`Candidate empty orphans to delete: ${idsToDelete.length}`);

  // Double check credits for candidate IDs in batches of 100
  const verifiedZeroCreditIds: string[] = [];
  for (let i = 0; i < idsToDelete.length; i += 100) {
    const chunk = idsToDelete.slice(i, i + 100);
    const { data: creds } = await supabase
      .from('credits')
      .select('person_id')
      .in('person_id', chunk);

    const activePids = new Set((creds || []).map(c => c.person_id));
    for (const id of chunk) {
      if (!activePids.has(id)) {
        verifiedZeroCreditIds.push(id);
      } else {
        console.log(`⚠️ Person ${id} actually has credits; recalculating film_count instead of deleting.`);
        const count = creds?.filter(c => c.person_id === id).length || 1;
        await supabase.from('people').update({ film_count: count }).eq('id', id);
      }
    }
  }

  console.log(`Verified ${verifiedZeroCreditIds.length} completely empty zero-credit orphans for deletion.`);

  // Delete verified zero-credit orphans in chunks of 50
  for (let i = 0; i < verifiedZeroCreditIds.length; i += 50) {
    const chunk = verifiedZeroCreditIds.slice(i, i + 50);
    const { error: delErr } = await supabase.from('people').delete().in('id', chunk);
    if (delErr) {
      console.error(`Error deleting chunk ${i}:`, delErr.message);
    } else {
      deletedOrphansCount += chunk.length;
      process.stdout.write(`\rDeleted ${deletedOrphansCount} / ${verifiedZeroCreditIds.length} empty orphans...`);
    }
  }

  console.log(`\n\n🎉 Cleanup Complete!`);
  console.log(`- Role/OCR noise deleted: ${deletedNoiseCount}`);
  console.log(`- Monikers rewired/preserved: Brodashagi -> Broda Shaggi merged; Abiymo, Abiayamo, Osereme preserved`);
  console.log(`- Empty orphans deleted: ${deletedOrphansCount}`);
  console.log(`- High-value profiles preserved (with bio/photo/awards/TMDb): ${totalPreserved}`);
}

main();
