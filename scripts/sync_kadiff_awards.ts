import { supabase } from './lib/db';

async function syncKADIFF() {
  console.log('🎬 Starting KADIFF (Kaduna International Film Festival) Awards Sync...\n');

  // People awards
  const peopleAwards = [
    {
      id: '9031f53c-e8c3-40c7-b27d-56024a9145c2', // Ekene Som Mekwunye
      award: {
        organization: 'KADIFF',
        category: 'Best Director',
        title: 'Best Director (3rd KADIFF)',
        year: 2020,
        season: 2020,
        won: true,
        work: 'Light in the Dark',
        film_id: 'a956e0d4-1b03-4fb6-acda-09f60f837254',
      },
    },
    {
      id: 'c71586e7-f571-47ea-aa94-d95185b1f748', // Rita Dominic
      award: {
        organization: 'KADIFF',
        category: 'Outstanding Lead Actress',
        title: 'Outstanding Lead Actress (3rd KADIFF)',
        year: 2020,
        season: 2020,
        won: true,
        work: 'Light in the Dark',
        film_id: 'a956e0d4-1b03-4fb6-acda-09f60f837254',
      },
    },
    {
      id: 'b1d86b0c-0864-460a-b538-2eb569ef0a98', // Joke Silva
      award: {
        organization: 'KADIFF',
        category: 'Outstanding Supporting Actress',
        title: 'Outstanding Supporting Actress (3rd KADIFF)',
        year: 2020,
        season: 2020,
        won: true,
        work: 'Light in the Dark',
        film_id: 'a956e0d4-1b03-4fb6-acda-09f60f837254',
      },
    },
    {
      id: '1ede6dad-a35c-4430-a20d-868e52ae3e6c', // Bimbo Ademoye
      award: {
        organization: 'KADIFF',
        category: 'Best Actress Nominee',
        title: 'Best Actress Nominee (7th KADIFF)',
        year: 2024,
        season: 2024,
        won: false,
        work: null,
      },
    },
    {
      id: '2c90e444-1d2c-4c09-a246-2b31ebaf31d6', // Kiki Omeili
      award: {
        organization: 'KADIFF',
        category: 'Best Actress Nominee',
        title: 'Best Actress Nominee (7th KADIFF)',
        year: 2024,
        season: 2024,
        won: false,
        work: null,
      },
    },
    {
      id: '58fcc995-074e-4b4a-a6ca-f9574bb5b813', // Femi Adebayo
      award: {
        organization: 'KADIFF',
        category: 'KADIFF Excellence Award',
        title: 'KADIFF Excellence Award (9th KADIFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
    {
      id: '15ad9102-d113-455a-b547-80f8cbddad5d', // Ali Nuhu
      award: {
        organization: 'KADIFF',
        category: 'KADIFF Excellence Award',
        title: 'KADIFF Excellence Award (9th KADIFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
    {
      id: '4bbc12f9-2dc9-466e-9b06-358231cfebe1', // Juliet Ibrahim
      award: {
        organization: 'KADIFF',
        category: 'KADIFF Excellence Award',
        title: 'KADIFF Excellence Award (9th KADIFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
    {
      id: '15c9c469-5dc8-4672-a87e-6308545efd93', // Uche Ogbodo
      award: {
        organization: 'KADIFF',
        category: 'KADIFF Excellence Award',
        title: 'KADIFF Excellence Award (9th KADIFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
  ];

  console.log('--- Syncing KADIFF People Awards ---');
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
        (a.organization === 'KADIFF' || a.organization === 'Kaduna International Film Festival') &&
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
      console.log(`✅ Added KADIFF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // Film awards
  const filmAwards = [
    {
      id: 'a956e0d4-1b03-4fb6-acda-09f60f837254', // Light in the Dark
      awards: [
        {
          organization: 'KADIFF',
          category: 'Best Director',
          title: 'Best Director - 3rd KADIFF',
          year: 2020,
          season: 2020,
          won: true,
          recipients: ['Ekene Som Mekwunye'],
        },
        {
          organization: 'KADIFF',
          category: 'Outstanding Lead Actress',
          title: 'Outstanding Lead Actress - 3rd KADIFF',
          year: 2020,
          season: 2020,
          won: true,
          recipients: ['Rita Dominic'],
        },
        {
          organization: 'KADIFF',
          category: 'Outstanding Supporting Actress',
          title: 'Outstanding Supporting Actress - 3rd KADIFF',
          year: 2020,
          season: 2020,
          won: true,
          recipients: ['Joke Silva'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing KADIFF Film Awards ---');
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
          (a.organization === 'KADIFF' || a.organization === 'Kaduna International Film Festival') &&
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
        console.log(`✅ Updated ${film.title} with ${addedCount} KADIFF award(s)`);
      }
    }
  }

  console.log('\n✨ All KADIFF awards synced successfully!');
}

syncKADIFF().catch(console.error);
