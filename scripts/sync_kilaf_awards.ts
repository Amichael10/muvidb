import { supabase } from './lib/db';

async function syncKILAF() {
  console.log('🎬 Starting KILAF (Kano Indigenous Languages of Africa Film Festival) Awards Sync...\n');

  // 1. Ensure Ladi Cima exists in people
  const { data: cimaExisting } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('slug', 'ladi-cima')
    .maybeSingle();

  let cimaId = cimaExisting?.id;
  if (!cimaId) {
    const { data: createdCima, error: cimaErr } = await supabase
      .from('people')
      .insert({
        name: 'Ladi Cima',
        slug: 'ladi-cima',
        known_for_department: 'Acting',
        bio: 'Ladi Cima is a legendary Nigerian veteran screen actress, widely celebrated for her performances in Hausa and indigenous language cinema, including her award-winning role in Kakanda.',
        awards: [],
      })
      .select('id')
      .single();

    if (cimaErr) console.log('Ladi Cima insert error:', cimaErr.message);
    cimaId = createdCima?.id;
  }

  // People awards
  const peopleAwards = [
    {
      id: cimaId,
      award: {
        organization: 'KILAF',
        category: 'Best Supporting Actress',
        title: 'Best Supporting Actress - KILAF 2025',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Kakanda',
        film_id: '4bbbd224-309c-4d2d-b3ae-960eb08457ac',
      },
    },
  ];

  console.log('--- Syncing KILAF People Awards ---');
  for (const item of peopleAwards) {
    if (!item.id) continue;
    const { data: person, error: fetchErr } = await supabase
      .from('people')
      .select('id, name, awards')
      .eq('id', item.id)
      .single();

    if (fetchErr || !person) {
      console.log(`❌ Failed finding person ${item.id}:`, fetchErr?.message);
      continue;
    }

    const currentAwards = Array.isArray(person.awards) ? person.awards : [];
    const exists = currentAwards.some(
      (a: any) =>
        (a.organization === 'KILAF' || a.organization === 'Kano Indigenous Languages of Africa Film Festival') &&
        Number(a.year) === item.award.year &&
        a.category?.toLowerCase() === item.award.category.toLowerCase()
    );

    if (exists) {
      console.log(`ℹ️ Already has award: ${person.name} -> ${item.award.category} (${item.award.year})`);
      continue;
    }

    const updated = [...currentAwards, item.award];
    const { error: updateErr } = await supabase
      .from('people')
      .update({ awards: updated })
      .eq('id', person.id);

    if (updateErr) {
      console.error(`❌ Error updating ${person.name}:`, updateErr.message);
    } else {
      console.log(`✅ Added KILAF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // Film awards
  const filmAwards = [
    {
      id: '4bbbd224-309c-4d2d-b3ae-960eb08457ac', // Kakanda
      awards: [
        {
          organization: 'KILAF',
          category: 'Best Feature Film',
          title: 'Best Feature Film - KILAF 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Kakanda'],
        },
        {
          organization: 'KILAF',
          category: 'Best Director',
          title: 'Best Director - KILAF 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Kakanda'],
        },
        {
          organization: 'KILAF',
          category: 'Best Screenplay',
          title: 'Best Screenplay - KILAF 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Kakanda'],
        },
        {
          organization: 'KILAF',
          category: 'Best Cinematography',
          title: 'Best Cinematography - KILAF 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Kakanda'],
        },
        {
          organization: 'KILAF',
          category: 'Best Supporting Actress',
          title: 'Best Supporting Actress - KILAF 2025',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Ladi Cima'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing KILAF Film Awards ---');
  for (const item of filmAwards) {
    const { data: film, error: fetchErr } = await supabase
      .from('films')
      .select('id, title, awards')
      .eq('id', item.id)
      .single();

    if (fetchErr || !film) {
      console.log(`❌ Failed finding film ${item.id}:`, fetchErr?.message);
      continue;
    }

    let currentAwards = Array.isArray(film.awards) ? [...film.awards] : [];
    let addedCount = 0;

    for (const aw of item.awards) {
      const exists = currentAwards.some(
        (a: any) =>
          (a.organization === 'KILAF' || a.organization === 'Kano Indigenous Languages of Africa Film Festival') &&
          Number(a.year) === aw.year &&
          a.category?.toLowerCase() === aw.category.toLowerCase()
      );

      if (exists) {
        console.log(`ℹ️ Film already has award: ${film.title} -> ${aw.category} (${aw.year})`);
        continue;
      }

      currentAwards.push(aw);
      addedCount++;
    }

    if (addedCount > 0) {
      const { error: updateErr } = await supabase
        .from('films')
        .update({ awards: currentAwards })
        .eq('id', film.id);

      if (updateErr) {
        console.error(`❌ Error updating film ${film.title}:`, updateErr.message);
      } else {
        console.log(`✅ Updated ${film.title} with ${addedCount} KILAF award(s)`);
      }
    }
  }

  console.log('\n✨ All KILAF awards synced successfully!');
}

syncKILAF().catch(console.error);
