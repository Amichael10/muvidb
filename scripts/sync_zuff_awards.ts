import { supabase } from './lib/db';

async function syncZUFF() {
  console.log('🎬 Starting ZUFF (Zuma Film Festival) Awards Sync...\n');

  // People awards
  const peopleAwards = [
    {
      id: '72bea59a-498d-4721-9a96-a659cd03f46a', // Awam Amkpa
      award: {
        organization: 'ZUFF',
        category: 'Best Director',
        title: 'Best Director (15th Zuma Film Festival)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'The Man Died',
        film_id: '136ac593-4f7b-40ad-948e-09e409bc1995',
      },
    },
    {
      id: 'afe1ad3e-47e3-42ba-a048-d635723a2edf', // Sam Dede
      award: {
        organization: 'ZUFF',
        category: 'Best Supporting Actor',
        title: 'Best Supporting Actor (15th Zuma Film Festival)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'The Man Died',
        film_id: '136ac593-4f7b-40ad-948e-09e409bc1995',
      },
    },
    {
      id: '3134f916-38b6-4a96-807a-922548089c82', // Abdulazeem M Ibrahim
      award: {
        organization: 'ZUFF',
        category: 'Best Actor',
        title: 'Best Actor (15th Zuma Film Festival)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Finding Nina',
        film_id: '96ca0c85-5c9e-4900-b15c-183038641c4b',
      },
    },
    {
      id: '8a15553e-e2c8-4e07-905b-eba77431ace5', // Abdulazeem Ibrahim (variant)
      award: {
        organization: 'ZUFF',
        category: 'Best Actor',
        title: 'Best Actor (15th Zuma Film Festival)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Finding Nina',
        film_id: '96ca0c85-5c9e-4900-b15c-183038641c4b',
      },
    },
    {
      id: '57ce1847-43d8-470f-8c49-0b06fb8d8d0e', // Ijapari Ben-Hirki
      award: {
        organization: 'ZUFF',
        category: 'Best Actress',
        title: 'Best Actress (15th Zuma Film Festival)',
        year: 2025,
        season: 2025,
        won: true,
        work: 'Finding Nina',
        film_id: '96ca0c85-5c9e-4900-b15c-183038641c4b',
      },
    },
    {
      id: '6201994a-fb90-4fb6-a150-a5ed7836bb72', // Kenneth Okolie
      award: {
        organization: 'ZUFF',
        category: 'Best Actor',
        title: 'Best Actor (13th Zuma Film Festival)',
        year: 2023,
        season: 2023,
        won: true,
        work: 'Face to Face',
        film_id: '977ff517-bf27-4b68-9c03-efee127c8be5',
      },
    },
    {
      id: '0037c1ad-7b81-43c4-8ee5-595aa5871090', // Onyeka Onwenu
      award: {
        organization: 'ZUFF',
        category: 'Lifetime Achievement Award',
        title: 'Lifetime Achievement Award (13th Zuma Film Festival)',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
    {
      id: 'cb16a183-4710-4b95-a3bc-730649182dbc', // Peter Fatomilola
      award: {
        organization: 'ZUFF',
        category: 'Lifetime Achievement Award',
        title: 'Lifetime Achievement Award (13th Zuma Film Festival)',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
  ];

  console.log('--- Syncing ZUFF People Awards ---');
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
        (a.organization === 'ZUFF' || a.organization === 'Zuma Film Festival') &&
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
      console.log(`✅ Added ZUFF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // Film awards
  const filmAwards = [
    {
      id: '136ac593-4f7b-40ad-948e-09e409bc1995', // The Man Died
      awards: [
        {
          organization: 'ZUFF',
          category: 'Best Picture',
          title: 'Best Picture - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Man Died'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Director',
          title: 'Best Director - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Awam Amkpa'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Supporting Actor',
          title: 'Best Supporting Actor - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Sam Dede'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Cinematography',
          title: 'Best Cinematography - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Man Died'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Costume',
          title: 'Best Costume - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Man Died'],
        },
      ],
    },
    {
      id: '96ca0c85-5c9e-4900-b15c-183038641c4b', // Finding Nina
      awards: [
        {
          organization: 'ZUFF',
          category: 'Best Actor',
          title: 'Best Actor - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Abdulazeem M. Ibrahim'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Actress',
          title: 'Best Actress - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Ijapari Ben-Hirki'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Sound',
          title: 'Best Sound - 15th Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['Finding Nina'],
        },
      ],
    },
    {
      id: '977ff517-bf27-4b68-9c03-efee127c8be5', // Face to Face
      awards: [
        {
          organization: 'ZUFF',
          category: 'Best Picture',
          title: 'Best Picture - 13th Zuma Film Festival',
          year: 2023,
          season: 2023,
          won: true,
          recipients: ['Face to Face'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Actor',
          title: 'Best Actor - 13th Zuma Film Festival',
          year: 2023,
          season: 2023,
          won: true,
          recipients: ['Kenneth Okolie'],
        },
      ],
    },
    {
      id: 'f504e181-4f53-4d3d-80a2-4d426ee79d82', // The Legend of the Vagabond Queen of Lagos
      awards: [
        {
          organization: 'ZUFF',
          category: 'Best Cinematography & Technical Excellence',
          title: 'Best Cinematography & Technical Excellence - Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Legend of the Vagabond Queen of Lagos'],
        },
        {
          organization: 'ZUFF',
          category: 'Best Costume',
          title: 'Best Costume - Zuma Film Festival',
          year: 2025,
          season: 2025,
          won: true,
          recipients: ['The Legend of the Vagabond Queen of Lagos'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing ZUFF Film Awards ---');
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
          (a.organization === 'ZUFF' || a.organization === 'Zuma Film Festival') &&
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
        console.log(`✅ Updated ${film.title} with ${addedCount} ZUFF award(s)`);
      }
    }
  }

  console.log('\n✨ All ZUFF awards synced successfully!');
}

syncZUFF().catch(console.error);
