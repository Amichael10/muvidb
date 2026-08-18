import { supabase } from './lib/db';

async function syncAIFF() {
  console.log('🎬 Starting AIFF (Abuja International Film Festival) Awards Sync...\n');

  // People awards
  const peopleAwards = [
    {
      id: '8769db39-88f7-4a01-aad6-c05499cef9a5', // Obi Emelonye
      award: {
        organization: 'AIFF',
        category: 'Outstanding Director',
        title: 'Outstanding Director (22nd AIFF)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Safari',
        film_id: '8d3ff323-25f1-4190-ae8f-cd2a42e684c9',
      },
    },
    {
      id: '2d545ec8-ad03-4eb8-bf3c-b0e921f6b59b', // Osas Ighodaro
      award: {
        organization: 'AIFF',
        category: 'Outstanding Actress',
        title: 'Outstanding Actress (22nd AIFF)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Safari',
        film_id: '8d3ff323-25f1-4190-ae8f-cd2a42e684c9',
      },
    },
    {
      id: '6fa82afa-9865-4a53-a439-0d6326138a3c', // Shaffy Bello
      award: {
        organization: 'AIFF',
        category: 'Outstanding Actress',
        title: 'Outstanding Actress (19th AIFF)',
        year: 2022,
        season: 2022,
        won: true,
        work: 'Obsession',
        film_id: '9d0d14dd-3cf8-4cd1-b7e8-5e41260dce6b',
      },
    },
    {
      id: '83eb65ae-57ae-4338-8d57-4c13537cd9bc', // Sambasa Nzeribe
      award: {
        organization: 'AIFF',
        category: 'Outstanding Actor',
        title: 'Outstanding Actor (19th AIFF)',
        year: 2022,
        season: 2022,
        won: true,
        work: 'Enough of the Silence',
        film_id: null,
      },
    },
    {
      id: 'c8122c22-b8c2-456f-857f-51f6f4762c6f', // Gabriel Afolayan
      award: {
        organization: 'AIFF',
        category: 'Outstanding Actor',
        title: 'Outstanding Actor (16th AIFF)',
        year: 2019,
        season: 2019,
        won: true,
        work: 'Gold Statue',
        film_id: '9d916eaa-ebfa-415f-acb2-4a59b67cf2ac',
      },
    },
    {
      id: '5df6cf29-1c4c-4e71-9ca6-80f7dbf15369', // Tade Ogidan
      award: {
        organization: 'AIFF',
        category: 'Special Recognition / Closing Feature',
        title: 'Special Recognition (16th AIFF)',
        year: 2019,
        season: 2019,
        won: true,
        work: 'Gold Statue',
        film_id: '9d916eaa-ebfa-415f-acb2-4a59b67cf2ac',
      },
    },
    {
      id: 'b6fbf5f1-ab10-4ded-9a70-e0ec177d89c3', // Elvina Ibru
      award: {
        organization: 'AIFF',
        category: 'Outstanding Actress',
        title: 'Outstanding Actress Nominee (16th AIFF)',
        year: 2019,
        season: 2019,
        won: false,
        work: 'The Bling Lagosians',
        film_id: '5347d4ee-55db-459c-9d38-6ce041dacd55',
      },
    },
    {
      id: '2ad6a32b-ef2f-4175-9439-58c02b025746', // Tana Adelana
      award: {
        organization: 'AIFF',
        category: 'Special Recognition Award',
        title: 'Special Recognition Award (14th AIFF)',
        year: 2017,
        season: 2017,
        won: true,
        work: null,
      },
    },
  ];

  console.log('--- Syncing AIFF People Awards ---');
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
        (a.organization === 'AIFF' || a.organization === 'Abuja International Film Festival') &&
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
      console.log(`✅ Added AIFF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // Film awards
  const filmAwards = [
    {
      id: '8d3ff323-25f1-4190-ae8f-cd2a42e684c9', // Safari
      awards: [
        {
          organization: 'AIFF',
          category: 'Golden Jury Award (Overall Best Film)',
          title: 'Golden Jury Award (Overall Best Film) - 22nd AIFF',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Safari'],
        },
        {
          organization: 'AIFF',
          category: 'Outstanding Director',
          title: 'Outstanding Director - 22nd AIFF',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Obi Emelonye'],
        },
        {
          organization: 'AIFF',
          category: 'Outstanding Actress',
          title: 'Outstanding Actress - 22nd AIFF',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Osas Ighodalo'],
        },
      ],
    },
    {
      id: '9d0d14dd-3cf8-4cd1-b7e8-5e41260dce6b', // Obsession
      awards: [
        {
          organization: 'AIFF',
          category: 'Outstanding Actress',
          title: 'Outstanding Actress - 19th AIFF',
          year: 2022,
          season: 2022,
          won: true,
          recipients: ['Shaffy Bello'],
        },
      ],
    },
    {
      id: '9d916eaa-ebfa-415f-acb2-4a59b67cf2ac', // Gold Statue
      awards: [
        {
          organization: 'AIFF',
          category: 'Outstanding Actor',
          title: 'Outstanding Actor - 16th AIFF',
          year: 2019,
          season: 2019,
          won: true,
          recipients: ['Gabriel Afolayan'],
        },
        {
          organization: 'AIFF',
          category: 'Special Recognition / Closing Feature',
          title: 'Special Recognition - 16th AIFF',
          year: 2019,
          season: 2019,
          won: true,
          recipients: ['Tade Ogidan'],
        },
      ],
    },
    {
      id: '5347d4ee-55db-459c-9d38-6ce041dacd55', // The Bling Lagosians
      awards: [
        {
          organization: 'AIFF',
          category: 'Outstanding Feature Film',
          title: 'Outstanding Feature Film Nominee - 16th AIFF',
          year: 2019,
          season: 2019,
          won: false,
          recipients: ['The Bling Lagosians'],
        },
      ],
    },
    {
      id: 'd0e30e54-9b25-4298-823e-9624e16dadbd', // Cold Feet
      awards: [
        {
          organization: 'AIFF',
          category: 'Outstanding Feature Film',
          title: 'Outstanding Feature Film Nominee - 16th AIFF',
          year: 2019,
          season: 2019,
          won: false,
          recipients: ['Cold Feet'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing AIFF Film Awards ---');
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
          (a.organization === 'AIFF' || a.organization === 'Abuja International Film Festival') &&
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
        console.log(`✅ Updated ${film.title} with ${addedCount} AIFF award(s)`);
      }
    }
  }

  console.log('\n✨ All AIFF awards synced successfully!');
}

syncAIFF().catch(console.error);
