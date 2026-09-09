import { supabase } from './lib/db.js';

// Helper to merge source person into target person
async function mergePersonIntoTarget(sourceId: string, targetId: string, sourceName: string, targetName: string) {
  if (sourceId === targetId) return;

  // 1. Fetch existing film_ids of target
  const { data: targetCredits } = await supabase
    .from('credits')
    .select('film_id')
    .eq('person_id', targetId);

  const existingFilmIds = new Set((targetCredits || []).map((c: any) => c.film_id));

  // 2. Fetch source credits
  const { data: sourceCredits } = await supabase
    .from('credits')
    .select('id, film_id')
    .eq('person_id', sourceId);

  if (sourceCredits && sourceCredits.length > 0) {
    const toDeleteIds: string[] = [];
    const toReassignIds: string[] = [];

    for (const cred of sourceCredits) {
      if (existingFilmIds.has(cred.film_id)) {
        toDeleteIds.push(cred.id);
      } else {
        toReassignIds.push(cred.id);
        existingFilmIds.add(cred.film_id);
      }
    }

    if (toDeleteIds.length > 0) {
      await supabase.from('credits').delete().in('id', toDeleteIds);
    }
    if (toReassignIds.length > 0) {
      await supabase.from('credits').update({ person_id: targetId }).in('id', toReassignIds);
    }
  }

  // 3. Update target film_count
  const { count: finalCount } = await supabase
    .from('credits')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', targetId);

  await supabase
    .from('people')
    .update({ film_count: finalCount || 0 })
    .eq('id', targetId);

  // 4. Delete source person
  await supabase.from('people').delete().eq('id', sourceId);
}

// Explicit High Profile Merges
const EXPLICIT_MERGES = [
  { targetName: 'Sanusi Izihaq', aliases: ['Sanusi Izihaq Adekunle', 'Sanusi Izihaq Apankufor', 'Sanusi Izihaq Apa'] },
  { targetName: 'Ibrahim Yekini', aliases: ['Ibrahim Yekini Bakare', 'Ibrahim Yekini Itele', 'Ibrahim Bakare Yekini'] },
  { targetName: 'Toyin Abraham', aliases: ['Toyin Abraham Ajeyemi'] },
  { targetName: 'Lizzy Gold Onuwaje', aliases: ['Lizzy Gold'] },
  { targetName: 'Femi Adebayo', aliases: ['Femi Adebayo Salami'] },
  { targetName: 'Kingsley Okereke', aliases: ['Kingsley Okereke Orji'] },
  { targetName: 'Anike Ami', aliases: ['Anike Ami Olaniyi'] },
  { targetName: 'Wunmi Toriola', aliases: ['Wunmi Toriola Wuraola'] },
  { targetName: 'Regina Daniels', aliases: ['Regina Daniels Nneamaka Nwoko'] },
  { targetName: 'Iyabo Ojo', aliases: ['Iyabo Ojo Iyabo Ojo'] },
  { targetName: 'Bolaji Amusan', aliases: ['Bolaji Amusan 2'] },
];

// Multi-actor combined records to split
const MULTI_ACTOR_GLITCHES = [
  { glitchName: 'Odunlade Adekola Esther Kalejaiye', actors: ['Odunlade Adekola', 'Esther Kalejaiye'] },
  { glitchName: 'Miriam Ogbonna Frederick Leonard', actors: ['Miriam Ogbonna', 'Frederick Leonard'] },
  { glitchName: 'Onyii Alex Uzor Arukwe', actors: ['Onyii Alex', 'Uzor Arukwe'] },
  { glitchName: 'Ebele Okaro. Crystal Okoye', actors: ['Ebele Okaro', 'Crystal Okoye'] },
  { glitchName: 'Afeez Owo, Segun Ogunsanya', actors: ['Afeez Owo', 'Segun Ogunsanya'] },
  { glitchName: 'Renike Oladimeji Damola Olatunji', actors: ['Renike Oladimeji', 'Damola Olatunji'] },
  { glitchName: 'Sanusi Izihaq, Sir Dele Ogundipe', actors: ['Sanusi Izihaq', 'Sir Dele Ogundipe'] },
  { glitchName: 'Bimbo Adebayo Adekunle Azeez', actors: ['Bimbo Adebayo', 'Adekunle Azeez'] },
  { glitchName: 'Terry Maurice Sam', actors: ['Maurice Sam'] },
  { glitchName: 'Regina Sonia Uche', actors: ['Sonia Uche', 'Regina Daniels'] },
];

// Noise suffixes to clean
const NOISE_SUFFIXES = [
  'Many More', 'many more', 'So On', 'so on', 'And Many More',
  'Associate Producerr', 'F Boioirec Ror'
];

async function runCleanup() {
  console.log('========================================================');
  console.log('🚀 NOLLYWOOD DUPLICATES & GLITCH RESOLUTION');
  console.log('========================================================\n');

  // STEP 1: Process Explicit Star Merges
  console.log('--- [1/3] Processing Major Star Name Aliases & Merges ---');
  for (const { targetName, aliases } of EXPLICIT_MERGES) {
    const { data: targets } = await supabase
      .from('people')
      .select('id, name, film_count')
      .ilike('name', targetName)
      .order('film_count', { ascending: false });

    const target = (targets || [])[0];
    if (!target) {
      console.log(`⚠️ Target "${targetName}" not found in DB.`);
      continue;
    }

    for (const alias of aliases) {
      const { data: aliasPeople } = await supabase
        .from('people')
        .select('id, name, film_count')
        .ilike('name', alias);

      for (const a of aliasPeople || []) {
        if (a.id !== target.id) {
          console.log(`🔀 Merging "${a.name}" (${a.id}) -> "${target.name}" (${target.id})`);
          await mergePersonIntoTarget(a.id, target.id, a.name, target.name);
          console.log(`✅ Merged "${a.name}" into "${target.name}"`);
        }
      }
    }
  }

  // STEP 2: Process Multi-Actor Glitch Splits
  console.log('\n--- [2/3] Processing Multi-Actor Glitch Splits ---');
  for (const { glitchName, actors } of MULTI_ACTOR_GLITCHES) {
    const { data: glitchMatches } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', `%${glitchName}%`);

    for (const glitchRecord of glitchMatches || []) {
      console.log(`✂️ Splitting multi-actor glitch: "${glitchRecord.name}" (${glitchRecord.id})`);

      // Find credits of the glitch record
      const { data: credits } = await supabase
        .from('credits')
        .select('id, film_id, role')
        .eq('person_id', glitchRecord.id);

      // Locate or create target actors
      const targetActorIds: string[] = [];
      for (const actorName of actors) {
        let { data: matches } = await supabase
          .from('people')
          .select('id, name')
          .ilike('name', actorName)
          .order('film_count', { ascending: false })
          .limit(1);

        if (matches && matches.length > 0) {
          targetActorIds.push(matches[0].id);
        } else {
          // Create actor if missing
          const { data: created } = await supabase
            .from('people')
            .insert({
              name: actorName,
              slug: actorName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              known_for_department: 'Acting',
              film_count: 0,
            })
            .select('id')
            .single();
          if (created) targetActorIds.push(created.id);
        }
      }

      // Assign each movie to all detected actors
      for (const cred of credits || []) {
        for (const actorId of targetActorIds) {
          const { data: exists } = await supabase
            .from('credits')
            .select('id')
            .eq('person_id', actorId)
            .eq('film_id', cred.film_id)
            .limit(1);

          if (!exists || exists.length === 0) {
            await supabase.from('credits').insert({
              person_id: actorId,
              film_id: cred.film_id,
              role: cred.role || 'actor',
            });
          }
        }
        // Delete original glitched credit
        await supabase.from('credits').delete().eq('id', cred.id);
      }

      // Delete the glitched person record
      await supabase.from('people').delete().eq('id', glitchRecord.id);
      console.log(`✅ Successfully resolved and removed "${glitchRecord.name}"`);
    }
  }

  // STEP 3: Clean Noise Suffixes ("Many More", etc.)
  console.log('\n--- [3/3] Cleaning Suffix Noise Records ("Many More", etc.) ---');
  for (const suffix of NOISE_SUFFIXES) {
    const { data: noisyPeople } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', `%${suffix}%`);

    for (const p of noisyPeople || []) {
      const cleanName = p.name.replace(new RegExp(suffix, 'gi'), '').replace(/[.,]/g, '').trim();
      if (!cleanName || cleanName.length < 3) {
        // Just delete noise
        await supabase.from('credits').delete().eq('person_id', p.id);
        await supabase.from('people').delete().eq('id', p.id);
        console.log(`🗑️ Deleted noise record: "${p.name}"`);
        continue;
      }

      // Find clean target
      const { data: targetMatches } = await supabase
        .from('people')
        .select('id, name')
        .ilike('name', cleanName)
        .order('film_count', { ascending: false })
        .limit(1);

      if (targetMatches && targetMatches.length > 0 && targetMatches[0].id !== p.id) {
        console.log(`🔀 Merging noise "${p.name}" -> clean "${targetMatches[0].name}"`);
        await mergePersonIntoTarget(p.id, targetMatches[0].id, p.name, targetMatches[0].name);
      } else {
        // Just rename to clean name
        await supabase.from('people').update({ name: cleanName }).eq('id', p.id);
        console.log(`✏️ Renamed "${p.name}" -> "${cleanName}"`);
      }
    }
  }

  console.log('\n========================================================');
  console.log('🎉 ALL DUPLICATES, GLITCHES, AND NOISE RESOLVED!');
  console.log('========================================================\n');
}

runCleanup().catch(console.error);
