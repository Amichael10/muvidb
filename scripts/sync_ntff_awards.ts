import { supabase } from './lib/db';

async function sync() {
  console.log('🎬 Starting NTFF (Nollywood Travel Film Festival) Awards Sync...\n');

  // Mapping of exact people IDs
  const peopleData = [
    {
      id: 'acb8f498-5882-4c50-a103-6acc7049a5e5', // Omotola Jalade Ekeinde
      filmId: '7dce27d9-8a36-4f06-aa27-aab97288c25b', // Alter Ego
      filmTitle: 'Alter Ego',
      award: {
        organization: 'NTFF',
        category: 'Best Actress',
        title: 'Best Actress - Toronto Edition',
        year: 2017,
        season: 2017,
        won: true,
        work: 'Alter Ego',
        film_id: '7dce27d9-8a36-4f06-aa27-aab97288c25b',
      },
    },
    {
      id: '1c3e561e-669c-4c3f-bd94-249009319f6a', // Niyi Akinmolayan
      filmId: '3ce218b4-a907-4d70-a738-9f11cae79a5e', // The Wedding Party 2
      filmTitle: 'The Wedding Party 2',
      award: {
        organization: 'NTFF',
        category: 'Best Director',
        title: 'Best Director - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'The Wedding Party 2',
        film_id: '3ce218b4-a907-4d70-a738-9f11cae79a5e',
      },
    },
    {
      id: 'be075130-585d-493a-8eb2-ce80dd0ccd4d', // Kalu Ikeagwu
      filmId: 'ddadb027-9528-4795-ada5-5c96f22bc400', // Dr. Mekam
      filmTitle: 'Dr. Mekam',
      award: {
        organization: 'NTFF',
        category: 'Best Actor',
        title: 'Best Actor - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'Dr. Mekam',
        film_id: 'ddadb027-9528-4795-ada5-5c96f22bc400',
      },
    },
    {
      id: 'd683c753-c383-4a22-9f18-990aba6beb6a', // Queen Nwokoye
      filmId: 'f4471785-b63e-4d2c-bcae-b556ee35fff3', // Excess Luggage
      filmTitle: 'Excess Luggage',
      award: {
        organization: 'NTFF',
        category: 'Best Actress',
        title: 'Best Actress - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'Excess Luggage',
        film_id: 'f4471785-b63e-4d2c-bcae-b556ee35fff3',
      },
    },
    {
      id: 'eacd3028-654d-4f97-aaf5-f7906008ea9e', // Ike Nnaebue
      filmId: 'ddadb027-9528-4795-ada5-5c96f22bc400', // Dr. Mekam
      filmTitle: 'Dr. Mekam',
      award: {
        organization: 'NTFF',
        category: 'Best Screenplay',
        title: 'Best Screenplay - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'Dr. Mekam',
        film_id: 'ddadb027-9528-4795-ada5-5c96f22bc400',
      },
    },
    {
      id: '1e39e267-a68d-4d96-a242-2a3302e4b136', // Adekunle Nodash Adejuyigbe
      filmId: '8652b36a-35a4-4c6d-bcda-355d604802be', // The Encounter
      filmTitle: 'The Encounter',
      award: {
        organization: 'NTFF',
        category: 'Best Cinematographer',
        title: 'Best Cinematographer - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'The Encounter',
        film_id: '8652b36a-35a4-4c6d-bcda-355d604802be',
      },
    },
    {
      id: '8a4d7738-71d0-4d05-a19e-cc71a3992afd', // Kunle 'Nodash' Adejuyigbe (variant record)
      filmId: '8652b36a-35a4-4c6d-bcda-355d604802be',
      filmTitle: 'The Encounter',
      award: {
        organization: 'NTFF',
        category: 'Best Cinematographer',
        title: 'Best Cinematographer - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'The Encounter',
        film_id: '8652b36a-35a4-4c6d-bcda-355d604802be',
      },
    },
    {
      id: 'da6668ec-f024-4d87-926f-4265d80cecdc', // Michael 'Truth' Ogunlade
      filmId: '8652b36a-35a4-4c6d-bcda-355d604802be', // The Encounter
      filmTitle: 'The Encounter',
      award: {
        organization: 'NTFF',
        category: 'Best Music Score',
        title: 'Best Music Score - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'The Encounter',
        film_id: '8652b36a-35a4-4c6d-bcda-355d604802be',
      },
    },
    {
      id: '676620ec-5004-41df-944f-e39b3ee62e54', // Richard Mofe-Damijo
      award: {
        organization: 'NTFF',
        category: 'Most Outstanding Individual in Nollywood',
        title: 'Most Outstanding Individual in Nollywood - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: null,
      },
    },
    {
      id: 'c978e486-0c46-4742-ac8a-cd5deb76abe0', // Richard Mofe Damijo (variant)
      award: {
        organization: 'NTFF',
        category: 'Most Outstanding Individual in Nollywood',
        title: 'Most Outstanding Individual in Nollywood - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: null,
      },
    },
  ];

  // 1. Check if Neville Sajere and Uchechi Treasure Okonkwo exist or need creation
  const { data: sajereExisting } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('slug', 'neville-sajere')
    .maybeSingle();

  let sajereId = sajereExisting?.id;
  if (!sajereId) {
    const { data: createdSajere, error: sajereErr } = await supabase
      .from('people')
      .insert({
        name: 'Neville Sajere',
        slug: 'neville-sajere',
        known_for_department: 'Production',
        bio: 'Neville Sajere is an international filmmaker and producer known for Nevada Productions and diaspora Nollywood films including A Little Too Late.',
        awards: [],
      })
      .select('id')
      .single();

    if (sajereErr) console.log('Sajere insert error:', sajereErr.message);
    sajereId = createdSajere?.id;
  }

  if (sajereId) {
    peopleData.push({
      id: sajereId,
      filmId: 'f1c0518b-fd36-45df-a562-de6cfb972e98', // A Little Too Late
      filmTitle: 'A Little Too Late',
      award: {
        organization: 'NTFF',
        category: 'Best Producer',
        title: 'Best Producer - Atlanta Edition',
        year: 2018,
        season: 2018,
        won: true,
        work: 'A Little Too Late',
        film_id: 'f1c0518b-fd36-45df-a562-de6cfb972e98',
      },
    });
  }

  const { data: adakirikiriExisting } = await supabase
    .from('people')
    .select('id, name, awards')
    .eq('slug', 'uchechi-treasure-okonkwo')
    .maybeSingle();

  let adakirikiriId = adakirikiriExisting?.id;
  if (!adakirikiriId) {
    const { data: createdAda, error: adaErr } = await supabase
      .from('people')
      .insert({
        name: 'Uchechi Treasure Okonkwo',
        slug: 'uchechi-treasure-okonkwo',
        known_for_department: 'Acting',
        bio: 'Uchechi Treasure Okonkwo, widely known as Adakirikiri, is a celebrated Nigerian teenage actress and gospel singer recognized with the Best Teen Actress award at the Nollywood Travel Film Festival.',
        awards: [],
      })
      .select('id')
      .single();

    if (adaErr) console.log('Adakirikiri insert error:', adaErr.message);
    adakirikiriId = createdAda?.id;
  }

  if (adakirikiriId) {
    peopleData.push({
      id: adakirikiriId,
      award: {
        organization: 'NTFF',
        category: 'Best Teen Actress',
        title: 'Best Teen Actress - Italy Edition',
        year: 2024,
        season: 2024,
        won: true,
        work: null,
      },
    });
  }

  // Sync People
  for (const item of peopleData) {
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
        (a.organization === 'NTFF' || a.organization === 'Nollywood Travel Film Festival') &&
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
      console.log(`✅ Added NTFF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // 2. Film Awards Data
  const filmsData = [
    {
      id: '3ce218b4-a907-4d70-a738-9f11cae79a5e', // The Wedding Party 2
      awards: [
        {
          organization: 'NTFF',
          category: 'Best Nigerian Film',
          title: 'Best Nigerian Film - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['The Wedding Party 2'],
        },
        {
          organization: 'NTFF',
          category: 'Best Director',
          title: 'Best Director - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Niyi Akinmolayan'],
        },
      ],
    },
    {
      id: '7dce27d9-8a36-4f06-aa27-aab97288c25b', // Alter Ego
      awards: [
        {
          organization: 'NTFF',
          category: 'Best Actress',
          title: 'Best Actress - Toronto Edition',
          year: 2017,
          season: 2017,
          won: true,
          recipients: ['Omotola Jalade-Ekeinde'],
        },
      ],
    },
    {
      id: 'ddadb027-9528-4795-ada5-5c96f22bc400', // Dr. Mekam
      awards: [
        {
          organization: 'NTFF',
          category: 'Best Actor',
          title: 'Best Actor - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Kalu Ikeagwu'],
        },
        {
          organization: 'NTFF',
          category: 'Best Screenplay',
          title: 'Best Screenplay - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Ike Nnaebue'],
        },
      ],
    },
    {
      id: 'f4471785-b63e-4d2c-bcae-b556ee35fff3', // Excess Luggage
      awards: [
        {
          organization: 'NTFF',
          category: 'Best Actress',
          title: 'Best Actress - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Queen Nwokoye'],
        },
      ],
    },
    {
      id: '8652b36a-35a4-4c6d-bcda-355d604802be', // The Encounter
      awards: [
        {
          organization: 'NTFF',
          category: 'Best Cinematographer',
          title: 'Best Cinematographer - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Adekunle Nodash Adejuyigbe'],
        },
        {
          organization: 'NTFF',
          category: 'Best Music Score',
          title: 'Best Music Score - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Michael Truth Ogunlade'],
        },
      ],
    },
    {
      id: 'f1c0518b-fd36-45df-a562-de6cfb972e98', // A Little Too Late
      awards: [
        {
          organization: 'NTFF',
          category: 'Best Nollywood Film in Diaspora',
          title: 'Best Nollywood Film in Diaspora - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Nevada Productions'],
        },
        {
          organization: 'NTFF',
          category: 'Best Producer',
          title: 'Best Producer - Atlanta Edition',
          year: 2018,
          season: 2018,
          won: true,
          recipients: ['Neville Sajere'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing Film Awards ---');
  for (const item of filmsData) {
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
          (a.organization === 'NTFF' || a.organization === 'Nollywood Travel Film Festival') &&
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
        console.log(`✅ Updated ${film.title} with ${addedCount} NTFF award(s)`);
      }
    }
  }

  console.log('\n✨ All NTFF awards synced successfully!');
}

sync().catch(console.error);
