import { supabase } from './lib/db';

async function syncAFFIF() {
  console.log('🎬 Starting AFFIF (Africa Films For Impact Festival) Awards Sync...\n');

  // People awards
  const peopleAwards = [
    {
      id: '4b3dcedd-2ed7-4f45-9690-ca8fefad1051', // Steve Gukas
      award: {
        organization: 'AFFIF',
        category: 'Honorary Recognition / Contribution to African Cinema',
        title: 'Honorary Recognition - Contribution to African Cinema (AFFIF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: '9944f587-714e-4ecf-bbfa-133a03357c56', // Biodun Stephen
      award: {
        organization: 'AFFIF',
        category: 'Honorary Recognition / Contribution to African Cinema',
        title: 'Honorary Recognition - Contribution to African Cinema (AFFIF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: '8b6afdf7-83d8-46b0-bc77-34509e2010f6', // Chris Odeh
      award: {
        organization: 'AFFIF',
        category: 'Honorary Recognition / Contribution to African Cinema',
        title: 'Honorary Recognition - Contribution to African Cinema (AFFIF 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: '6bafab0e-3e5a-48b3-8e34-f1c154628003', // Prince Daniel Aboki
      award: {
        organization: 'AFFIF',
        category: 'Best Film on Women Empowerment & Social Impact',
        title: 'Best Film on Women Empowerment (AFFIF Impact Awards 2025)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Kaka',
        film_id: 'e6230a5a-6a03-41e4-bb0a-28690493b239',
      },
    },
  ];

  console.log('--- Syncing AFFIF People Awards ---');
  for (const item of peopleAwards) {
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
        (a.organization === 'AFFIF' || a.organization === 'Africa Films For Impact Festival') &&
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
      console.log(`✅ Added AFFIF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // Film awards
  const filmAwards = [
    {
      id: 'e6230a5a-6a03-41e4-bb0a-28690493b239', // Kaka
      awards: [
        {
          organization: 'AFFIF',
          category: 'Best Film on Women Empowerment & Social Impact',
          title: 'Best Film on Women Empowerment - AFFIF Impact Awards',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Kaka'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing AFFIF Film Awards ---');
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
          (a.organization === 'AFFIF' || a.organization === 'Africa Films For Impact Festival') &&
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
        console.log(`✅ Updated ${film.title} with ${addedCount} AFFIF award(s)`);
      }
    }
  }

  console.log('\n✨ All AFFIF awards synced successfully!');
}

syncAFFIF().catch(console.error);
