import { serviceSupabase } from './lib/credit_consensus_verifier';

function normalizeNameKey(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(' ');
}

// Preferred names for reordered / alias pairs
const PREFERRED_NAME_CHOICES: Record<string, string> = {
  'cindy onyii umeh': 'Onyii Cindy Umeh',
  'abebe moet': 'Moët Abebe',
  'amoo omobolanle': 'Omobolanle Amoo',
  'gold ikponmwosa': 'Ikponmwosa Gold',
  'afolabi olaoluwa': 'Olaoluwa Afolabi',
  'afolabi olalekan': 'Olalekan Afolabi',
  'ajayi oluwadamilola': 'Oluwadamilola Ajayi',
  'apel papel paul': 'Paul Apel Papel',
  'rabiu rikadawa': 'Rikadawa Rabiu',
  'momodu pascal': 'Pascal Momodu',
  'kehinde soyebo': 'Kehinde Soyebo',
};

async function mergeDuplicatePeople() {
  console.log('🚀 Starting fast merge of duplicate people records...');

  // 1. Fetch all people
  let allPeople: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await serviceSupabase
      .from('people')
      .select('id, name, bio, film_count, nationality, gender, created_at')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching people:', error);
      break;
    }
    if (!data || data.length === 0) break;
    allPeople = allPeople.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Loaded ${allPeople.length} people records.`);

  // 2. Group by normalized key
  const groupMap = new Map<string, any[]>();
  for (const p of allPeople) {
    if (!p.name) continue;
    const key = normalizeNameKey(p.name);
    if (!key || key.split(' ').length < 2) continue;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(p);
  }

  const duplicateGroups: { key: string; records: any[] }[] = [];
  for (const [key, records] of groupMap.entries()) {
    const unique = Array.from(new Map(records.map(r => [r.id, r])).values());
    if (unique.length > 1) {
      duplicateGroups.push({ key, records: unique });
    }
  }

  console.log(`Found ${duplicateGroups.length} duplicate groups to merge.\n`);

  let totalMergedRecords = 0;
  let totalCreditsTransferred = 0;

  for (const group of duplicateGroups) {
    const uniqueRecords = group.records;
    if (uniqueRecords.length <= 1) continue;

    // Score records: bio (30pts), film_count (1pt each), preferred name match (100pts), proper casing (10pts)
    const scoredRecords = uniqueRecords.map(r => {
      let score = 0;
      if (r.bio && r.bio.length > 10) score += 30;
      score += (r.film_count || 0);

      const preferred = PREFERRED_NAME_CHOICES[group.key];
      if (preferred && r.name === preferred) score += 100;
      if (r.name !== r.name.toUpperCase()) score += 10;

      return { record: r, score };
    });

    scoredRecords.sort((a, b) => b.score - a.score);
    const primary = scoredRecords[0].record;
    const secondaries = scoredRecords.slice(1).map(s => s.record);

    console.log(`\n📌 Primary: "${primary.name}" (${primary.id})`);

    // Optionally update primary name if a preferred canonical casing is designated
    if (PREFERRED_NAME_CHOICES[group.key] && primary.name !== PREFERRED_NAME_CHOICES[group.key]) {
      const canonicalName = PREFERRED_NAME_CHOICES[group.key];
      await serviceSupabase.from('people').update({ name: canonicalName }).eq('id', primary.id);
      primary.name = canonicalName;
      console.log(`   ✏️ Updated primary name to: "${canonicalName}"`);
    }

    // Fetch existing credits for primary in one query
    const { data: primaryCredits } = await serviceSupabase
      .from('credits')
      .select('id, film_id, role')
      .eq('person_id', primary.id);

    const primaryCreditSet = new Set((primaryCredits || []).map(c => `${c.film_id}|${c.role}`));

    // Merge each secondary into primary
    for (const sec of secondaries) {
      if (sec.id === primary.id) continue;
      console.log(`   Merging secondary: "${sec.name}" (${sec.id})...`);

      // A. Fetch secondary credits
      const { data: secCredits } = await serviceSupabase
        .from('credits')
        .select('id, film_id, role')
        .eq('person_id', sec.id);

      if (secCredits && secCredits.length > 0) {
        const toDeleteIds: string[] = [];
        const toTransferIds: string[] = [];

        for (const cred of secCredits) {
          const signature = `${cred.film_id}|${cred.role}`;
          if (primaryCreditSet.has(signature)) {
            toDeleteIds.push(cred.id);
          } else {
            toTransferIds.push(cred.id);
            primaryCreditSet.add(signature);
          }
        }

        if (toDeleteIds.length > 0) {
          // Batch delete duplicates
          await serviceSupabase.from('credits').delete().in('id', toDeleteIds);
        }

        if (toTransferIds.length > 0) {
          // Batch transfer credits
          await serviceSupabase.from('credits').update({ person_id: primary.id }).in('id', toTransferIds);
          totalCreditsTransferred += toTransferIds.length;
        }
      }

      // B. Delete secondary person record
      const { error: delErr } = await serviceSupabase
        .from('people')
        .delete()
        .eq('id', sec.id);

      if (!delErr) {
        totalMergedRecords++;
        console.log(`   ✅ Merged & deleted "${sec.name}" (${sec.id})`);
      } else {
        console.error(`   ⚠️ Failed to delete "${sec.name}":`, delErr.message);
      }
    }

    // C. Recalculate distinct film_count on primary
    const { data: finalCredits } = await serviceSupabase
      .from('credits')
      .select('film_id')
      .eq('person_id', primary.id);

    const distinctFilms = new Set((finalCredits || []).map(c => c.film_id)).size;
    await serviceSupabase
      .from('people')
      .update({ film_count: distinctFilms })
      .eq('id', primary.id);

    console.log(`   🎬 Updated "${primary.name}" total film_count to ${distinctFilms}`);
  }

  console.log('\n======================================================');
  console.log('🎉 DUPLICATE PEOPLE MERGE COMPLETED SUCCESSFULLY!');
  console.log(`Duplicate Groups Handled: ${duplicateGroups.length}`);
  console.log(`Secondary Records Merged & Deleted: ${totalMergedRecords}`);
  console.log(`Credits Consolidated/Transferred: ${totalCreditsTransferred}`);
  console.log('======================================================');
}

mergeDuplicatePeople().catch(console.error);
