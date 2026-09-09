import { supabase } from './lib/db.js';
import fs from 'fs';
import path from 'path';

// 1. Genuine Nollywood Monikers mapping: Moniker Name -> Canonical Full Name
const MONIKER_MERGES: { moniker: string; canonicalName: string }[] = [
  { moniker: 'babawande', canonicalName: 'Kareem Adepoju' },
  { moniker: 'apa', canonicalName: 'Sanusi Izihaq' },
  { moniker: 'kemity', canonicalName: 'Kemi Ariyo' },
  { moniker: 'iteledicon', canonicalName: 'Ibrahim Yekini' },
  { moniker: 'sanyeri', canonicalName: 'Olaniyi Afonja' },
  { moniker: 'okele', canonicalName: 'Tunde Usman' },
  { moniker: 'lalude', canonicalName: 'Fatai Odua' },
  { moniker: 'aki', canonicalName: 'Chinedu Ikedieze' },
  { moniker: 'pawpaw', canonicalName: 'Osita Iheme' },
  { moniker: 'kok', canonicalName: 'Kanayo O. Kanayo' },
  { moniker: 'madam saje', canonicalName: 'Fausat Balogun' },
  { moniker: 'saka', canonicalName: 'Afeez Oyetoro' },
  { moniker: 'dejo', canonicalName: 'Kunle Mac-Tokunbo' },
  { moniker: 'alapinni', canonicalName: 'Ganiu Nafiu' },
];

async function mergeMonikers() {
  console.log('========================================================');
  console.log('🎭 MERGING GENUINE NOLLYWOOD MONIKERS INTO CANONICAL ACTORS');
  console.log('========================================================');

  for (const { moniker, canonicalName } of MONIKER_MERGES) {
    // 1. Find the moniker record
    const { data: monikerMatches } = await supabase
      .from('people')
      .select('id, name, film_count')
      .ilike('name', moniker);

    const monikerRecord = (monikerMatches || []).find(
      p => p.name.trim().toLowerCase() === moniker.toLowerCase()
    );

    if (!monikerRecord) {
      console.log(`ℹ️ Moniker "${moniker}" not found as separate record.`);
      continue;
    }

    // 2. Find or create canonical actor
    let { data: canonicalMatches } = await supabase
      .from('people')
      .select('id, name, film_count')
      .ilike('name', canonicalName)
      .order('film_count', { ascending: false });

    let canonicalRecord = (canonicalMatches || [])[0];

    if (!canonicalRecord) {
      console.log(`✨ Creating canonical record for "${canonicalName}"...`);
      const slug = canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: created, error: createErr } = await supabase
        .from('people')
        .insert({
          name: canonicalName,
          slug,
          known_for_department: 'Acting',
          film_count: 0,
        })
        .select('id, name, film_count')
        .single();

      if (createErr || !created) {
        console.error(`❌ Failed to create "${canonicalName}":`, createErr);
        continue;
      }
      canonicalRecord = created;
    }

    console.log(`\n🔀 Merging "${monikerRecord.name}" (${monikerRecord.id}) -> "${canonicalRecord.name}" (${canonicalRecord.id})`);

    // 3. Reassign credits
    const { data: credits, error: credErr } = await supabase
      .from('credits')
      .select('id, film_id, role, character_name')
      .eq('person_id', monikerRecord.id);

    if (credErr) {
      console.error(`Error fetching credits for ${monikerRecord.name}:`, credErr);
      continue;
    }

    console.log(`  Found ${credits?.length || 0} credits to transfer.`);

    for (const cred of credits || []) {
      // Check if canonical actor already has credit on this film
      const { data: existingCred } = await supabase
        .from('credits')
        .select('id')
        .eq('person_id', canonicalRecord.id)
        .eq('film_id', cred.film_id)
        .limit(1);

      if (existingCred && existingCred.length > 0) {
        // Already has credit, delete duplicate
        await supabase.from('credits').delete().eq('id', cred.id);
      } else {
        // Transfer credit
        await supabase
          .from('credits')
          .update({
            person_id: canonicalRecord.id,
            character_name: cred.character_name || monikerRecord.name,
          })
          .eq('id', cred.id);
      }
    }

    // 4. Update canonical film count
    const { count: finalFilmCount } = await supabase
      .from('credits')
      .select('id', { count: 'exact', head: true })
      .eq('person_id', canonicalRecord.id);

    await supabase
      .from('people')
      .update({ film_count: finalFilmCount || 0 })
      .eq('id', canonicalRecord.id);

    // 5. Delete old moniker record
    await supabase.from('people').delete().eq('id', monikerRecord.id);

    console.log(`✅ Successfully merged "${monikerRecord.name}" into "${canonicalRecord.name}"! Final film count: ${finalFilmCount}`);
  }
}

async function purgeContaminatedFirstNames() {
  console.log('\n========================================================');
  console.log('🧹 PURGING CONTAMINATED SINGLE FIRST NAMES');
  console.log('========================================================');

  const reportPath = path.resolve(process.cwd(), 'scratch/single_names_report.json');
  if (!fs.existsSync(reportPath)) {
    console.error('scratch/single_names_report.json not found!');
    return;
  }

  const allSingleNames = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const protectedMonikers = MONIKER_MERGES.map(m => m.moniker.toLowerCase());

  // Filter out the protected monikers
  const toDelete = allSingleNames.filter((item: any) => {
    const nameLower = item.name.toLowerCase().trim();
    return !protectedMonikers.includes(nameLower);
  });

  console.log(`Found ${toDelete.length} contaminated single-name records to purge.`);

  let deletedPeople = 0;
  let deletedCredits = 0;

  for (let i = 0; i < toDelete.length; i++) {
    const person = toDelete[i];
    
    // 1. Delete associated credits first
    const { data: creds, error: credErr } = await supabase
      .from('credits')
      .delete()
      .eq('person_id', person.id)
      .select('id');

    if (creds) {
      deletedCredits += creds.length;
    }

    // 2. Delete person record
    const { error: pErr } = await supabase
      .from('people')
      .delete()
      .eq('id', person.id);

    if (!pErr) {
      deletedPeople++;
    }

    if ((i + 1) % 50 === 0 || i === toDelete.length - 1) {
      console.log(`[${i + 1}/${toDelete.length}] Purged ${deletedPeople} single-name records (${deletedCredits} junk credits removed)...`);
    }
  }

  console.log('\n========================================================');
  console.log(`🎉 PURGE COMPLETED!`);
  console.log(`• People deleted: ${deletedPeople}`);
  console.log(`• Junk credits deleted: ${deletedCredits}`);
  console.log('========================================================\n');
}

async function run() {
  await mergeMonikers();
  await purgeContaminatedFirstNames();
}

run().catch(console.error);
