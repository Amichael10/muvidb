import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

function normalize(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function runMergeActors() {
  console.log('=== LIVE EXECUTION: Merging Duplicate Actor Clusters ===');

  // Fetch all people
  let allPeople: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, film_count, photo_url, bio, created_at')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allPeople.push(...data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Loaded ${allPeople.length} people.`);

  const peopleGroups: Record<string, any[]> = {};
  for (const p of allPeople) {
    const norm = normalize(p.name);
    if (!norm || norm.length < 3) continue;
    if (!peopleGroups[norm]) peopleGroups[norm] = [];
    peopleGroups[norm].push(p);
  }

  const dupClusters = Object.entries(peopleGroups).filter(([_, list]) => list.length > 1);
  console.log(`Found ${dupClusters.length} clusters.`);

  for (const [norm, list] of dupClusters) {
    // Determine canonical person
    list.sort((a, b) => {
      let scoreA = (a.film_count || 0);
      let scoreB = (b.film_count || 0);
      if (a.photo_url) scoreA += 500;
      if (b.photo_url) scoreB += 500;
      if (a.bio) scoreA += 300;
      if (b.bio) scoreB += 300;
      if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(a.name)) scoreA += 50;
      if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(b.name)) scoreB += 50;
      return scoreB - scoreA;
    });

    let canonical = list[0];
    let duplicates = list.slice(1);

    // Special cluster adjustments:
    if (norm === 'bentouitou') {
      // canonical should be Ben Toui Tou (with 4 films), but rename to 'Ben Touitou'
      const withFilms = list.find(p => p.film_count > 0) || canonical;
      canonical = withFilms;
      duplicates = list.filter(p => p.id !== canonical.id);
      await supabase.from('people').update({ name: 'Ben Touitou' }).eq('id', canonical.id);
    } else if (norm === 'adeyinkaadegbite') {
      // 27 films record is canonical, rename to proper Title Case
      const with27 = list.find(p => p.id === 'bebbeff5-6d4b-45e3-a40f-867597d97fbb') || canonical;
      canonical = with27;
      duplicates = list.filter(p => p.id !== canonical.id);
      await supabase.from('people').update({ name: 'Adeyinka Adegbite' }).eq('id', canonical.id);
    } else if (norm === 'ajiboyeolawusi') {
      // 8 films record is canonical, rename to Title Case
      const with8 = list.find(p => p.id === 'fa200beb-f731-4f1c-be46-3d4087e282d7') || canonical;
      canonical = with8;
      duplicates = list.filter(p => p.id !== canonical.id);
      await supabase.from('people').update({ name: 'Ajiboye Olawusi' }).eq('id', canonical.id);
    } else if (norm === 'okele') {
      await supabase.from('people').update({ name: 'Okele' }).eq('id', canonical.id);
    }

    console.log(`\nCluster "${norm}": CANONICAL -> "${canonical.name}" (${canonical.id})`);

    for (const dup of duplicates) {
      console.log(`  Merging duplicate "${dup.name}" (${dup.id}) into canonical...`);

      // 1. Fetch credits of duplicate
      const { data: dupCredits } = await supabase
        .from('credits')
        .select('id, film_id, role, character_name, billing_order')
        .eq('person_id', dup.id);

      if (dupCredits && dupCredits.length > 0) {
        const { data: canonCredits } = await supabase
          .from('credits')
          .select('id, film_id, role, character_name, billing_order')
          .eq('person_id', canonical.id);

        const canonFilmMap = new Map<string, any>();
        for (const cc of canonCredits || []) {
          if (cc.film_id) canonFilmMap.set(cc.film_id, cc);
        }

        for (const dc of dupCredits) {
          if (!dc.film_id) continue;
          const existing = canonFilmMap.get(dc.film_id);
          if (existing) {
            // Person already credited! Zero duplicate guarantee
            const updates: any = {};
            if (!existing.character_name && dc.character_name) updates.character_name = dc.character_name;
            if ((!existing.role || existing.role === 'cast') && dc.role && dc.role !== 'cast') updates.role = dc.role;
            if ((existing.billing_order == null || existing.billing_order > 50) && dc.billing_order != null) updates.billing_order = dc.billing_order;
            if (Object.keys(updates).length > 0) {
              await supabase.from('credits').update(updates).eq('id', existing.id);
            }
            await supabase.from('credits').delete().eq('id', dc.id);
          } else {
            await supabase.from('credits').update({ person_id: canonical.id }).eq('id', dc.id);
            canonFilmMap.set(dc.film_id, dc);
          }
        }
      }

      // 2. Stage credits
      const { data: dupStageCredits } = await supabase
        .from('stage_credits')
        .select('id')
        .eq('person_id', dup.id);
      if (dupStageCredits && dupStageCredits.length > 0) {
        for (const sc of dupStageCredits) {
          await supabase.from('stage_credits').update({ person_id: canonical.id }).eq('id', sc.id);
        }
      }

      // 3. Delete duplicate person record
      const { error: delErr } = await supabase.from('people').delete().eq('id', dup.id);
      if (delErr) {
        console.error(`    Error deleting dup ${dup.id}:`, delErr);
      } else {
        console.log(`    ✓ Re-linked credits and deleted duplicate [${dup.id}]`);
      }
    }

    // 4. Update canonical film_count
    const { count: finalCount } = await supabase
      .from('credits')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', canonical.id);
    await supabase.from('people').update({ film_count: finalCount || 0 }).eq('id', canonical.id);
    console.log(`  ✓ Updated canonical film_count to ${finalCount}`);
  }

  // Final step: Merge Lizzy Gold into Lizzy Gold Onuwaje
  console.log('\n--- Merging Lizzy Gold into Lizzy Gold Onuwaje ---');
  const LIZZY_CANON_ID = 'b87cdd62-42ab-4e28-9d05-37f8465a0a9f'; // Lizzy Gold Onuwaje
  const LIZZY_DUP_ID = 'd2232465-beb9-4cd5-b8e1-21aaf67eb85a'; // Lizzy Gold

  const { data: lizzyDupCreds } = await supabase
    .from('credits')
    .select('id, film_id, role, character_name, billing_order')
    .eq('person_id', LIZZY_DUP_ID);

  if (lizzyDupCreds && lizzyDupCreds.length > 0) {
    const { data: lizzyCanonCreds } = await supabase
      .from('credits')
      .select('id, film_id')
      .eq('person_id', LIZZY_CANON_ID);
    const lizzyFilmSet = new Set(lizzyCanonCreds?.map(c => c.film_id) || []);

    for (const c of lizzyDupCreds) {
      if (lizzyFilmSet.has(c.film_id)) {
        await supabase.from('credits').delete().eq('id', c.id);
      } else {
        await supabase.from('credits').update({ person_id: LIZZY_CANON_ID }).eq('id', c.id);
        lizzyFilmSet.add(c.film_id);
      }
    }
    await supabase.from('people').delete().eq('id', LIZZY_DUP_ID);
    console.log('✓ Successfully merged Lizzy Gold into Lizzy Gold Onuwaje!');
  }

  const { count: lizzyCount } = await supabase
    .from('credits')
    .select('*', { count: 'exact', head: true })
    .eq('person_id', LIZZY_CANON_ID);
  await supabase.from('people').update({ film_count: lizzyCount || 0 }).eq('id', LIZZY_CANON_ID);
  console.log(`✓ Updated Lizzy Gold Onuwaje film_count to ${lizzyCount}`);

  console.log('\n🎉 ALL DUPLICATE ACTOR CLUSTERS SUCCESSFULLY MERGED!');
}

runMergeActors().catch(console.error);
