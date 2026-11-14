import { supabase } from '../api/_lib/supabase.js';

async function syncAfriff2026() {
  console.log('🎬 Starting AFRIFF 2026 Globe Awards Sync (Lagos, November 7, 2026)...\n');

  // 1. Film Awards
  const filmAwards = [
    {
      filmId: '2b91ad10-360b-47bb-9dbb-69409b8ed592', // Slum Bomber
      title: 'Slum Bomber',
      award: {
        organization: 'AFRIFF',
        category: 'Best Feature Film',
        title: 'Best Feature Film (AFRIFF Globe Awards 2026)',
        year: 2026,
        season: 2026,
        won: true,
        recipients: ['Slum Bomber'],
      },
    },
    {
      filmId: 'e222e217-6f68-4097-a353-f52f2f59559f', // Lady
      title: 'Lady',
      award: {
        organization: 'AFRIFF',
        category: 'Best Director',
        title: 'Best Director - Olive Nwosu (AFRIFF Globe Awards 2026)',
        year: 2026,
        season: 2026,
        won: true,
        recipients: ['Olive Nwosu'],
      },
    },
    {
      filmId: '699e582c-2931-4646-9b91-bdea545e114f', // Adanne
      title: 'Adanne',
      award: {
        organization: 'AFRIFF',
        category: 'Audience Choice Award',
        title: 'Audience Choice Award (AFRIFF Globe Awards 2026)',
        year: 2026,
        season: 2026,
        won: true,
        recipients: ['Adanne'],
      },
    },
  ];

  console.log('--- Syncing AFRIFF 2026 Film Awards ---');
  for (const item of filmAwards) {
    const { data: film, error: fetchErr } = await supabase
      .from('films')
      .select('id, title, awards')
      .eq('id', item.filmId)
      .single();

    if (fetchErr || !film) {
      console.error(`❌ Film not found for ${item.title} (${item.filmId}):`, fetchErr?.message);
      continue;
    }

    const currentAwards = Array.isArray(film.awards) ? [...film.awards] : [];
    const exists = currentAwards.some(
      (a: any) =>
        a.organization === 'AFRIFF' &&
        Number(a.year) === 2026 &&
        a.category?.toLowerCase() === item.award.category.toLowerCase()
    );

    if (exists) {
      console.log(`ℹ️ Film already has AFRIFF 2026 award: ${film.title} -> ${item.award.category}`);
      continue;
    }

    const updatedAwards = [...currentAwards, item.award];
    const { error: updateErr } = await supabase
      .from('films')
      .update({ awards: updatedAwards })
      .eq('id', film.id);

    if (updateErr) {
      console.error(`❌ Error updating film ${film.title}:`, updateErr.message);
    } else {
      console.log(`✅ Added AFRIFF 2026 Award to ${film.title}: ${item.award.category} (${item.award.year})`);
    }
  }

  // 2. People Awards
  const peopleAwards = [
    {
      personId: '359d9ff4-47cc-4bd4-9f39-a7226ed1ebdf', // Olive Nwosu
      name: 'Olive Nwosu',
      award: {
        organization: 'AFRIFF',
        category: 'Best Director',
        title: 'Best Director (AFRIFF Globe Awards 2026)',
        year: 2026,
        season: 2026,
        won: true,
        work: 'Lady',
        film_id: 'e222e217-6f68-4097-a353-f52f2f59559f',
      },
    },
    {
      personId: '106735e1-60a9-4a54-be83-7ef5f20356e9', // Orobosa Ikponmwen
      name: 'Orobosa Ikponmwen',
      award: {
        organization: 'AFRIFF',
        category: 'Audience Choice Award',
        title: 'Audience Choice Award (AFRIFF Globe Awards 2026)',
        year: 2026,
        season: 2026,
        won: true,
        work: 'Adanne',
        film_id: '699e582c-2931-4646-9b91-bdea545e114f',
      },
    },
    {
      personId: '120678bc-b891-42b3-b148-ad97bf583b6b', // Kene Okwuosa
      name: 'Kene Okwuosa',
      award: {
        organization: 'AFRIFF',
        category: 'Special Recognition / Industry Leadership Award',
        title: 'Special Recognition - Industry Leadership & Cinema Contribution (AFRIFF 2026)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
  ];

  console.log('\n--- Syncing AFRIFF 2026 People Awards ---');
  for (const item of peopleAwards) {
    const { data: person, error: fetchErr } = await supabase
      .from('people')
      .select('id, name, awards')
      .eq('id', item.personId)
      .single();

    if (fetchErr || !person) {
      console.error(`❌ Person not found for ${item.name} (${item.personId}):`, fetchErr?.message);
      continue;
    }

    const currentAwards = Array.isArray(person.awards) ? [...person.awards] : [];
    const exists = currentAwards.some(
      (a: any) =>
        a.organization === 'AFRIFF' &&
        Number(a.year) === 2026 &&
        a.category?.toLowerCase() === item.award.category.toLowerCase()
    );

    if (exists) {
      console.log(`ℹ️ Person already has AFRIFF 2026 award: ${person.name} -> ${item.award.category}`);
      continue;
    }

    const updatedAwards = [...currentAwards, item.award];
    const { error: updateErr } = await supabase
      .from('people')
      .update({ awards: updatedAwards })
      .eq('id', person.id);

    if (updateErr) {
      console.error(`❌ Error updating person ${person.name}:`, updateErr.message);
    } else {
      console.log(`✅ Added AFRIFF 2026 Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  console.log('\n🎉 AFRIFF 2026 Globe Awards sync complete!');
}

syncAfriff2026().catch(console.error);
