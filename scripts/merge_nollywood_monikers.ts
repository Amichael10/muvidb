import { supabase } from './lib/db.js';

interface MonikerMergePlan {
  canonicalId: string;
  canonicalName: string;
  duplicateIds: string[];
  duplicateNames: string[];
  aliasesToAdd: string[];
}

const plans: MonikerMergePlan[] = [
  {
    // Toyin Oladiran / Abeni Agbon
    canonicalId: '675faaf1-4f69-4365-a789-eb1fbdabac15',
    canonicalName: 'Toyin Oladiran',
    duplicateIds: [
      '0c41bbe4-878b-43e8-a419-dde43dcb5354', // Abeni Agbon (3 films)
      '04a45331-2dc1-4ee4-8a28-d2857169a382', // Toyin Abeni Agbon (1 film)
    ],
    duplicateNames: ['Abeni Agbon', 'Toyin Abeni Agbon'],
    aliasesToAdd: ['Abeni Agbon', 'Toyin Abeni Agbon', 'Oladiran Toyin', 'Abeniagbon'],
  },
  {
    // Mama No Network / Kudirat Soremi
    canonicalId: '1d4e2b49-e5e0-44e2-aa79-388be3834b71',
    canonicalName: 'Mama No Network',
    duplicateIds: [],
    duplicateNames: [],
    aliasesToAdd: ['Kudirat Soremi', 'Kudirat Soremi Odugbemi', 'Kudirat Sorenat', 'Mama Nonetwork'],
  },
  {
    // Olaniyi Afonja / Sanyeri
    canonicalId: '0fe048c9-0db0-4777-89b8-abd105919876',
    canonicalName: 'Olaniyi Afonja',
    duplicateIds: [
      '947c9230-5b64-45b3-9473-35326381c4a5', // Afonja Sanyeri (2 films)
    ],
    duplicateNames: ['Afonja Sanyeri'],
    aliasesToAdd: ['Sanyeri', 'Afonja Sanyeri', 'Olaniyi Sanyeri'],
  },
  {
    // Wale Akorede / Okunnu
    canonicalId: '36d649b0-d295-4dce-90e3-5a9e9ea35d95',
    canonicalName: 'Wale Akorede',
    duplicateIds: [
      '856fb936-8c64-4ba6-917c-6cf1073c1448', // Okunnu (1 film)
    ],
    duplicateNames: ['Okunnu'],
    aliasesToAdd: ['Okunnu', 'Wale Akorede Okunnu'],
  },
  {
    // Taiwo Hassan / Ogogo
    canonicalId: '30525889-ae80-4bb6-95de-d70c453b3814',
    canonicalName: 'Taiwo Hassan',
    duplicateIds: [
      '49261312-9dcf-488e-93f8-34721b163014', // Hassan Ogogo (1 film)
    ],
    duplicateNames: ['Hassan Ogogo'],
    aliasesToAdd: ['Ogogo', 'Hassan Ogogo', 'Taiwo Hassan Ogogo'],
  },
  {
    // Afeez Oyetoro / Saka
    canonicalId: 'f27f2054-1d0d-4040-9fae-7adef2a03c39',
    canonicalName: 'Afeez Oyetoro',
    duplicateIds: [
      '0a600a34-7b03-49bb-a6f9-36da62c88be4', // Afeez Oyetoro Saka (3 films)
      '9f996921-07bc-4687-b814-1fe6cd785d81', // Saka Hafiz Oyetoro (0 films)
    ],
    duplicateNames: ['Afeez Oyetoro Saka', 'Saka Hafiz Oyetoro'],
    aliasesToAdd: ['Saka', 'Afeez Oyetoro Saka', 'Kokanndi'],
  },
  {
    // Sunday Omobolanle / Aluwe / Papi Luwe
    canonicalId: '52a42fe7-2203-4872-afb8-3cfd8f89e1a5',
    canonicalName: 'Sunday Omobolanle',
    duplicateIds: [],
    duplicateNames: [],
    aliasesToAdd: ['Aluwe', 'Papi Luwe', 'Sunday Omobolanle Aluwe'],
  },
  {
    // Yahaya Habeeb Olatunji / Baba Kamo
    canonicalId: 'a663fe2d-421e-4b1e-b579-90410c24153c',
    canonicalName: 'Yahaya Habeeb Olatunji',
    duplicateIds: [
      '4ce89624-3f9c-4e07-ac93-a194327192d0', // Yahaya Habeeb Baba Kamo (2 films)
    ],
    duplicateNames: ['Yahaya Habeeb Baba Kamo'],
    aliasesToAdd: ['Baba Kamo', 'Yahaya Habeeb Baba Kamo'],
  },
  {
    // Olutayo Amokade / Ijebu
    canonicalId: 'da93a656-2bf1-491d-8ec9-f955b5f45c57',
    canonicalName: 'Olutayo Amokade',
    duplicateIds: [],
    duplicateNames: [],
    aliasesToAdd: ['Ijebu', 'Olatayo Amokade', 'Tayo Amokade'],
  },
];

const APPLY = process.argv.includes('--apply');

async function main() {
  console.log(`Nollywood Moniker Consolidator (apply=${APPLY})\n`);

  for (const p of plans) {
    console.log(`----------------------------------------------------`);
    console.log(`Canonical: ${p.canonicalName} (${p.canonicalId})`);
    if (p.duplicateIds.length) {
      console.log(`Duplicates to absorb: ${p.duplicateNames.join(', ')} (${p.duplicateIds.join(', ')})`);
    } else {
      console.log(`Aliases only.`);
    }
    console.log(`Aliases to ensure: ${p.aliasesToAdd.join(', ')}`);

    if (!APPLY) continue;

    // 1. Clear mubi_slug on duplicates
    if (p.duplicateIds.length) {
      await supabase.from('people').update({ mubi_slug: null }).in('id', p.duplicateIds);

      // 2. Re-point existing aliases from duplicates to primary
      await supabase
        .from('person_aliases')
        .update({ person_id: p.canonicalId })
        .in('person_id', p.duplicateIds);

      // 3. Merge group via RPC
      const { error: mergeError } = await supabase.rpc('merge_people_group', {
        p_master_id: p.canonicalId,
        p_duplicate_ids: p.duplicateIds,
        p_metadata: {},
      });
      if (mergeError) {
        console.error(`  ❌ Failed merge for ${p.canonicalName}:`, mergeError.message);
      } else {
        console.log(`  ✓ Merged ${p.duplicateNames.join(', ')} into ${p.canonicalName}`);
      }
    }

    // 4. Ensure all aliases exist on canonical
    for (const alias of p.aliasesToAdd) {
      const key = alias.toLowerCase().trim().replace(/[^a-z0-9]+/g, '');
      const { data: existing } = await supabase
        .from('person_aliases')
        .select('id')
        .eq('person_id', p.canonicalId)
        .eq('alias_key', key)
        .maybeSingle();
      if (!existing) {
        await supabase.from('person_aliases').insert({
          person_id: p.canonicalId,
          alias: alias.trim(),
          source: 'moniker_merge',
        });
        console.log(`  ✓ Registered alias: "${alias}"`);
      } else {
        console.log(`  - Alias already registered: "${alias}"`);
      }
    }

    // 5. Update film_count on canonical
    const { count: actualFilmCount } = await supabase
      .from('credits')
      .select('film_id', { count: 'exact', head: true })
      .eq('person_id', p.canonicalId);
    if (actualFilmCount !== undefined) {
      await supabase.from('people').update({ film_count: actualFilmCount }).eq('id', p.canonicalId);
      console.log(`  ✓ Updated film_count: ${actualFilmCount}`);
    }
  }

  console.log(`\nCompleted moniker consolidation.`);
}

main().catch(console.error);
