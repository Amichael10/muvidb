import { supabase } from './lib/db';

async function syncAmaaAfricanLanguage2024() {
  console.log('🎬 Syncing AMAA 2024 Ousmane Sembène Award for Best Film in an African Language...\n');

  const nominations = [
    {
      filmId: 'e181e710-f5c3-441f-a84c-a8848944e20b', // Jagun Jagun
      title: 'Jagun Jagun',
      award: {
        organization: 'AMAA',
        category: 'Ousmane Sembène Award for Best Film in an African Language',
        title: 'Ousmane Sembène Award for Best Film in an African Language Nominee - 20th AMAA',
        year: 2024,
        season: 20,
        won: false,
        recipients: ['Jagun Jagun', 'Femi Adebayo'],
      },
    },
    {
      filmId: 'e6230a5a-6a03-41e4-bb0a-28690493b239', // Kaka
      title: 'Kaka',
      award: {
        organization: 'AMAA',
        category: 'Ousmane Sembène Award for Best Film in an African Language',
        title: 'Ousmane Sembène Award for Best Film in an African Language Nominee - 20th AMAA',
        year: 2024,
        season: 20,
        won: false,
        recipients: ['Kaka', 'Prince Daniel Aboki'],
      },
    },
    {
      filmId: '6037d303-a809-4674-a85b-e41ddf4166d1', // Out of Breath
      title: 'Out of Breath',
      award: {
        organization: 'AMAA',
        category: 'Ousmane Sembène Award for Best Film in an African Language',
        title: 'Ousmane Sembène Award for Best Film in an African Language Nominee - 20th AMAA',
        year: 2024,
        season: 20,
        won: false,
        recipients: ['Out of Breath'],
      },
    },
  ];

  // 1. Update Films
  console.log('--- Updating Films ---');
  for (const item of nominations) {
    const { data: film, error: fetchErr } = await supabase
      .from('films')
      .select('id, title, awards')
      .eq('id', item.filmId)
      .single();

    if (fetchErr || !film) {
      console.log(`❌ Failed finding film ${item.title}:`, fetchErr?.message);
      continue;
    }

    const currentAwards = Array.isArray(film.awards) ? [...film.awards] : [];
    const exists = currentAwards.some(
      (a: any) =>
        (a.organization === 'AMAA' || a.organization === 'Africa Movie Academy Awards') &&
        Number(a.year) === 2024 &&
        a.category?.toLowerCase().includes('african language')
    );

    if (exists) {
      console.log(`ℹ️ Already has nomination: ${film.title}`);
      continue;
    }

    currentAwards.push(item.award);
    const { error: updateErr } = await supabase
      .from('films')
      .update({ awards: currentAwards })
      .eq('id', film.id);

    if (updateErr) {
      console.error(`❌ Error updating ${film.title}:`, updateErr.message);
    } else {
      console.log(`✅ Added AMAA 2024 African Language nomination to ${film.title}`);
    }
  }

  // 2. Update People
  console.log('\n--- Updating People ---');
  const peopleAwards = [
    {
      id: '58fcc995-074e-4b4a-a6ca-f9574bb5b813', // Femi Adebayo
      award: {
        organization: 'AMAA',
        category: 'Ousmane Sembène Award for Best Film in an African Language',
        title: 'Ousmane Sembène Award for Best Film in an African Language Nominee (20th AMAA)',
        year: 2024,
        season: 20,
        won: false,
        work: 'Jagun Jagun',
        film_id: 'e181e710-f5c3-441f-a84c-a8848944e20b',
      },
    },
    {
      id: '6bafab0e-3e5a-48b3-8e34-f1c154628003', // Prince Daniel Aboki
      award: {
        organization: 'AMAA',
        category: 'Ousmane Sembène Award for Best Film in an African Language',
        title: 'Ousmane Sembène Award for Best Film in an African Language Nominee (20th AMAA)',
        year: 2024,
        season: 20,
        won: false,
        work: 'Kaka',
        film_id: 'e6230a5a-6a03-41e4-bb0a-28690493b239',
      },
    },
  ];

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

    const currentAwards = Array.isArray(person.awards) ? [...person.awards] : [];
    const exists = currentAwards.some(
      (a: any) =>
        (a.organization === 'AMAA' || a.organization === 'Africa Movie Academy Awards') &&
        Number(a.year) === 2024 &&
        a.category?.toLowerCase().includes('african language')
    );

    if (exists) {
      console.log(`ℹ️ Already has nomination: ${person.name}`);
      continue;
    }

    currentAwards.push(item.award);
    const { error: updateErr } = await supabase
      .from('people')
      .update({ awards: currentAwards })
      .eq('id', person.id);

    if (updateErr) {
      console.error(`❌ Error updating ${person.name}:`, updateErr.message);
    } else {
      console.log(`✅ Added AMAA 2024 African Language nomination to ${person.name}`);
    }
  }

  console.log('\n✨ Done syncing AMAA 2024 nominations!');
}

syncAmaaAfricanLanguage2024().catch(console.error);
