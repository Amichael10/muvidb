import { supabase } from './lib/db.js';

interface MergeSpec {
  canonicalId: string;
  canonicalName?: string;
  aliasesToAdd?: string[];
  secondaryIds: string[];
  description: string;
}

const MERGE_SPECS: MergeSpec[] = [
  // 1. Mo Bimpe / Bimpe Oyebade / Adebimpe Oyebade / Mobimpe Adedimeji
  {
    canonicalId: '4d6223e8-b0f1-40b8-a2dd-15351c6d3c8c',
    canonicalName: 'Bimpe Oyebade Adedimeji',
    aliasesToAdd: ['Mo Bimpe', 'Adebimpe Oyebade', 'Bimpe Oyebade', 'Mobimpe Adedimeji', 'Bimpe Oyebade'],
    secondaryIds: [
      '40101ec6-79e4-48d8-bdc7-11d20d71250f', // Mo Bimpe
      'e63a6ab1-c1e4-4a8f-9b75-fc35bbdc2fee', // Adebimpe Oyebade
      '73a307e0-6bf4-4ad3-84dc-773f8cb2d1bf', // Bimpe Oyebade
      '97a1161b-aaf3-41fc-9989-4143a524e7ee', // Mobimpe Adedimeji
    ],
    description: 'Mo Bimpe / Adebimpe Oyebade / Bimpe Oyebade Adedimeji',
  },

  // 2. Bimpe Akintunde / Adebimpe Akintunde
  {
    canonicalId: '02811ae8-cea8-4d08-be3b-2f8b8416b943',
    canonicalName: 'Bimpe Akintunde',
    aliasesToAdd: ['Adebimpe Akintunde', 'Wasila Coded'],
    secondaryIds: ['cdba3734-77df-43b6-9cea-65e2d653edb4'],
    description: 'Bimpe Akintunde / Adebimpe Akintunde',
  },

  // 3. Toyin Abraham / Toyin Aimakhu
  {
    canonicalId: '0d98131e-e156-4126-a555-f43c136835a4',
    canonicalName: 'Toyin Abraham',
    aliasesToAdd: ['Toyin Aimakhu', 'Toyin Abraham Ajeyemi', 'Mummy Ire', 'World Best'],
    secondaryIds: ['4bbd50c4-8f10-4ce5-8503-896a9fb2e4ca'],
    description: 'Toyin Abraham / Toyin Aimakhu',
  },

  // 4. Faithia Williams / Faithia Balogun
  {
    canonicalId: '29fa0652-89ca-4fe0-b67e-8549afde6bc5',
    canonicalName: 'Faithia Williams',
    aliasesToAdd: ['Faithia Balogun', 'Fathia Williams', 'Faithia Williams Balogun', 'Fathia Balogun', 'Faithia Balogun Williams', 'Fathia Balogun Williams'],
    secondaryIds: [
      '52ca7a95-1774-40ba-a5f6-99aaf227b419', // Faithia Williams Balogun
      'c912ad43-c7f3-493a-86f7-a30290c0ae93', // Faithia Balogun
      '886e36ca-b080-45f4-a3cd-dd7c2adf253a', // Faithia Balogun Williams
      '6b2a9ca1-83ec-4a78-bcec-e975792c76f4', // Faithia Williams
      'd04a4a0e-cdb2-4788-80f9-0ea47f49b5d3', // Fathia Balogun Williams
    ],
    description: 'Faithia Williams / Faithia Balogun / Fathia Williams',
  },

  // 5. Saidi Balogun / Said Balogun
  {
    canonicalId: '02beae94-736d-417b-9925-a1d04476b47a',
    canonicalName: 'Saidi Balogun',
    aliasesToAdd: ['Said Balogun', 'Saheed Balogun'],
    secondaryIds: ['7b04bf69-a0b8-4705-ad8f-6abf2805548b'],
    description: 'Saidi Balogun / Said Balogun',
  },

  // 6. Zubby Michael / Zubby Micheal
  {
    canonicalId: '66f582f0-053d-44bc-aab1-e0c24537015a',
    canonicalName: 'Zubby Michael',
    aliasesToAdd: ['Zubby Micheal', 'Eze Ndi Ala'],
    secondaryIds: ['4c321b4c-84c2-43b5-b5a8-0e18b7a30c85'],
    description: 'Zubby Michael / Zubby Micheal',
  },

  // 7. Mide Martins / Mide Martins Abiodun
  {
    canonicalId: 'cf3ce7ee-2323-4420-9db4-d25ba15c2a43',
    canonicalName: 'Mide Martins',
    aliasesToAdd: ['Mide Martins Abiodun', 'Mide Funmi Martins'],
    secondaryIds: ['29350fa5-34fb-4728-90d9-81d374dbbdcd'],
    description: 'Mide Martins / Mide Martins Abiodun',
  },

  // 8. Afeez Abiodun / Afeez Abiodun Owo
  {
    canonicalId: '04ca51bf-c15a-4004-aaaa-febb81f2a42a',
    canonicalName: 'Afeez Abiodun',
    aliasesToAdd: ['Afeez Owo', 'Afeez Abiodun Owo'],
    secondaryIds: ['0d8307c9-900a-425f-a607-0b395776e4a1'],
    description: 'Afeez Abiodun / Afeez Abiodun Owo',
  },

  // 9. Taiwo Hassan / Taiwo Hassan Ogogo
  {
    canonicalId: '30525889-ae80-4bb6-95de-d70c453b3814',
    canonicalName: 'Taiwo Hassan',
    aliasesToAdd: ['Ogogo', 'Taiwo Hassan Ogogo'],
    secondaryIds: ['486e710d-996f-40ff-b284-4ef96fdba1b7'],
    description: 'Taiwo Hassan / Taiwo Hassan Ogogo',
  },

  // 10. Bolaji Amusan / Mr Latin
  {
    canonicalId: 'de919d40-b6c3-4942-a477-99ec5d1e44d6',
    canonicalName: 'Bolaji Amusan',
    aliasesToAdd: ['Mr Latin', 'Bolaji Amusan (Mr Latin)'],
    secondaryIds: ['dc4e98c7-901e-4d11-9e91-a341376ffac1'],
    description: 'Bolaji Amusan / Mr Latin',
  },

  // 11. Kareem Adepoju / Babawande Kareem Adepoju
  {
    canonicalId: '672d4d72-086b-49f4-afc4-3a7531a09e78',
    canonicalName: 'Kareem Adepoju',
    aliasesToAdd: ['Babawande', 'Baba Wande', 'Babawande Kareem Adepoju'],
    secondaryIds: ['4fec43ad-0063-4ea1-9500-8d2976b66bea'],
    description: 'Kareem Adepoju / Babawande Kareem Adepoju',
  },

  // 12. Olaniyi Afonja / Afonja Sanyeri / Olaniyi Afonja Sanyeri
  {
    canonicalId: '0fe048c9-0db0-4777-89b8-abd105919876',
    canonicalName: 'Olaniyi Afonja',
    aliasesToAdd: ['Sanyeri', 'Afonja Sanyeri', 'Olaniyi Afonja Sanyeri'],
    secondaryIds: [
      'aa08a7b7-0ec0-4e6f-805a-e78b19490d03', // Afonja Sanyeri
      '42cb76f4-b12a-4414-9b67-54b6dbd1bdc4', // Olaniyi Afonja Sanyeri
    ],
    description: 'Olaniyi Afonja / Afonja Sanyeri',
  },

  // 13. Adebayo Salami / OGA Bello
  {
    canonicalId: 'ea118ca8-ad67-4df1-8220-300b0e766409',
    canonicalName: 'Adebayo Salami',
    aliasesToAdd: ['Oga Bello', 'OGA Bello', 'Alhaji Adebayo Salami'],
    secondaryIds: ['af4b00f1-0065-482f-9a69-ce9df7fe1b78'],
    description: 'Adebayo Salami / OGA Bello',
  },

  // 14. Mercy Johnson / Mercy Johnson Okojie
  {
    canonicalId: '91fc0a9a-1767-49fa-a8f9-dd4bbd408a48',
    canonicalName: 'Mercy Johnson',
    aliasesToAdd: ['Mercy Johnson Okojie', 'Mercy Johnson-Okojie'],
    secondaryIds: ['9edec7f6-8695-4a59-a30e-727ba01cdc85'],
    description: 'Mercy Johnson / Mercy Johnson Okojie',
  },

  // 15. Richard Mofe-Damijo / Richard Mofe
  {
    canonicalId: '676620ec-5004-41df-944f-e39b3ee62e54',
    canonicalName: 'Richard Mofe-Damijo',
    aliasesToAdd: ['RMD', 'Richard Mofe Damijo', 'Richard Mofe'],
    secondaryIds: ['597ea8ba-fda5-47b8-a395-9ffc1566194b'],
    description: 'Richard Mofe-Damijo / Richard Mofe',
  },

  // 16. Omotola Jalade Ekeinde / Omotola Jalade
  {
    canonicalId: 'acb8f498-5882-4c50-a103-6acc7049a5e5',
    canonicalName: 'Omotola Jalade Ekeinde',
    aliasesToAdd: ['Omotola Jalade', 'Omosexy'],
    secondaryIds: ['82ba1e6e-2bf1-420e-abba-4f4874f0ba94'],
    description: 'Omotola Jalade Ekeinde / Omotola Jalade',
  },

  // 17. Ronke Ojo / Ronke Oshodi-Ojo / Ronke Oshodi Oke / Ronke Ojo Anthony
  {
    canonicalId: 'df24e3b0-c772-4f78-8cbf-f3b47a4881f2',
    canonicalName: 'Ronke Ojo',
    aliasesToAdd: ['Ronke Oshodi-Ojo', 'Ronke Oshodi Oke', 'Ronke Ojo Anthony', 'Ronke Oshodi'],
    secondaryIds: [
      '7924d483-4e38-4e41-a7b8-2841a8a123f9', // Ronke Oshodi-Ojo
      'e9327889-1797-4bb8-ba36-80d66dadaf9a', // Ronke Ojo Anthony
      '08f52867-ece5-4a65-9ac4-671d653e017d', // Ronke Oshodi Oke
      'd0b2a9eb-d975-447d-9a3e-39eacc2dc3a7', // Ronke Oshodi
    ],
    description: 'Ronke Ojo / Ronke Oshodi-Ojo / Ronke Oshodi Oke',
  },

  // 18. Seyi Edun / Oluwaseyi Edun Johnson
  {
    canonicalId: '06a49c31-d36a-49d5-88ba-dd350badad01',
    canonicalName: 'Seyi Edun',
    aliasesToAdd: ['Oluwaseyi Edun', 'Oluwaseyi Edun Johnson', 'Shai'],
    secondaryIds: ['33c1628f-5aa6-4df0-84a3-6ec5790a944e'],
    description: 'Seyi Edun / Oluwaseyi Edun Johnson',
  },

  // 19. Binta Ayo Mogaji / Ayo Mogaji
  {
    canonicalId: '1ade2d89-61eb-42e3-ac68-c9dce0ab3c27',
    canonicalName: 'Binta Ayo Mogaji',
    aliasesToAdd: ['Ayo Mogaji', 'Binta Mogaji'],
    secondaryIds: ['71571578-def2-402a-a0a0-90dbfc4c4246'],
    description: 'Binta Ayo Mogaji / Ayo Mogaji',
  },

  // 20. Kiki Bakare / Kiki Bakare Ojo
  {
    canonicalId: '418aec19-6392-460b-81a1-e5a6b0f4d221',
    canonicalName: 'Kiki Bakare',
    aliasesToAdd: ['Kiki Bakare Ojo'],
    secondaryIds: ['d7a68693-bf68-4b9b-987d-a7427d22ea9a'],
    description: 'Kiki Bakare / Kiki Bakare Ojo',
  },

  // 21. Dele Odule / DELE ODULE BODE
  {
    canonicalId: '5f14553d-9bd5-4d8c-95c5-445727ca83e3',
    canonicalName: 'Dele Odule',
    aliasesToAdd: ['Dele Odule Bode'],
    secondaryIds: ['2464a7fd-0077-45b9-9807-2e68c8ad4e2d'],
    description: 'Dele Odule / DELE ODULE BODE',
  },
];

async function executeMerges() {
  console.log('🚀 Starting Nollywood Duplicates & Aliases Merging...');

  for (const spec of MERGE_SPECS) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing: ${spec.description}`);

    // 1. Fetch canonical person
    const { data: canonical, error: cErr } = await supabase
      .from('people')
      .select('*')
      .eq('id', spec.canonicalId)
      .maybeSingle();

    if (cErr || !canonical) {
      console.error(`❌ Canonical person not found: ${spec.canonicalId}`, cErr);
      continue;
    }

    // 2. Fetch existing credits for canonical to avoid duplicate roles on same film
    const { data: existingCredits } = await supabase
      .from('credits')
      .select('film_id, role')
      .eq('person_id', spec.canonicalId);

    const canonicalCreditKeys = new Set(
      (existingCredits || []).map((c: any) => `${c.film_id}_${(c.role || '').toLowerCase()}`)
    );

    let creditsMoved = 0;
    let creditsDeleted = 0;

    for (const secId of spec.secondaryIds) {
      // Fetch credits for secondary
      const { data: secCredits } = await supabase
        .from('credits')
        .select('*')
        .eq('person_id', secId);

      if (secCredits && secCredits.length > 0) {
        for (const cred of secCredits) {
          const key = `${cred.film_id}_${(cred.role || '').toLowerCase()}`;
          if (canonicalCreditKeys.has(key)) {
            // Already credited to canonical on this film with this role
            await supabase.from('credits').delete().eq('id', cred.id);
            creditsDeleted++;
          } else {
            // Reassign to canonical
            await supabase.from('credits').update({ person_id: spec.canonicalId }).eq('id', cred.id);
            canonicalCreditKeys.add(key);
            creditsMoved++;
          }
        }
      }

      try {
        await supabase.from('film_cast').update({ person_id: spec.canonicalId }).eq('person_id', secId);
      } catch {}
      try {
        await supabase.from('film_crew').update({ person_id: spec.canonicalId }).eq('person_id', secId);
      } catch {}

      // Delete secondary person
      const { error: delErr } = await supabase.from('people').delete().eq('id', secId);
      if (delErr) {
        console.warn(`⚠️ Could not delete secondary person ${secId}: ${delErr.message}`);
      } else {
        console.log(`   ✓ Merged and deleted secondary ID: ${secId}`);
      }
    }

    // 3. Update canonical aliases, name, and film_count
    const currentAliases: string[] = Array.isArray(canonical.aliases) ? canonical.aliases : [];
    const aliasSet = new Set(currentAliases.map(a => a.toLowerCase().trim()));
    const finalAliases = [...currentAliases];

    for (const a of (spec.aliasesToAdd || [])) {
      if (!aliasSet.has(a.toLowerCase().trim()) && a.toLowerCase().trim() !== canonical.name.toLowerCase().trim()) {
        finalAliases.push(a);
        aliasSet.add(a.toLowerCase().trim());
      }
    }

    // Recount total distinct films
    const { count: finalFilmCount } = await supabase
      .from('credits')
      .select('film_id', { count: 'exact', head: true })
      .eq('person_id', spec.canonicalId);

    const updatePayload: any = {
      aliases: finalAliases,
      film_count: finalFilmCount || canonical.film_count || 0,
      updated_at: new Date().toISOString(),
    };
    if (spec.canonicalName) {
      updatePayload.name = spec.canonicalName;
    }

    await supabase.from('people').update(updatePayload).eq('id', spec.canonicalId);

    console.log(`✅ [${spec.canonicalName || canonical.name}] Updated: ${finalAliases.length} aliases, ${finalFilmCount} total credits (Moved: ${creditsMoved}, Deduped: ${creditsDeleted})`);
  }

  // Handle glitched Desmond Elliot split
  console.log('\nHandling Desmond Elliot glitched split...');
  const glitchId = 'b886f232-303f-4005-88f0-ba24071ec1a8';
  const { data: desmondCanonical } = await supabase.from('people').select('id').ilike('name', 'Desmond Elliot').eq('film_count', 4).maybeSingle();
  if (desmondCanonical) {
    await supabase.from('credits').update({ person_id: desmondCanonical.id }).eq('person_id', glitchId);
    await supabase.from('people').delete().eq('id', glitchId);
    console.log('✅ Split & reallocated Desmond Elliot glitch credits.');
  }

  // Delete noise names
  const noiseIds = ['c7e0a44d-968d-4f96-9f58-75b09c915fc1']; // "Ebere Okaro Many Others"
  for (const nId of noiseIds) {
    await supabase.from('credits').delete().eq('person_id', nId);
    await supabase.from('people').delete().eq('id', nId);
  }
  console.log('✅ Deleted noise names.');

  console.log('\n✨ ALL NOLLEWOOD MERGES COMPLETED SUCCESSFULLY!');
}

executeMerges().catch(console.error);
