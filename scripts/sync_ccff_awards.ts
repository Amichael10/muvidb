import { supabase } from './lib/db';

async function syncCCFF() {
  console.log('🎬 Starting CCFF (Coal City Film Festival) Awards Sync...\n');

  // People awards
  const peopleAwards = [
    {
      id: '5c0e2fae-e941-431e-aa3e-16f3d5be42f7', // Felix Ugo Omokhodion
      award: {
        organization: 'CCFF',
        category: 'Best Lead Act',
        title: 'Best Lead Act - Coal City Film Festival Awards',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
    {
      id: 'f366e752-0f21-4253-9be6-f33092cdb10d', // Felix Omokhodion (alias)
      award: {
        organization: 'CCFF',
        category: 'Best Lead Act',
        title: 'Best Lead Act - Coal City Film Festival Awards',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
    {
      id: '0f53ca3a-b63d-435a-a2b8-64f4ad26ddd2', // Bob-Manuel Udokwu
      award: {
        organization: 'CCFF',
        category: 'CCFF Hall of Fame Inductee',
        title: 'CCFF Hall of Fame Inductee (6th CCFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
    {
      id: '11b69ebe-d660-42b8-9454-31d724c4370b', // Ernest Obi
      award: {
        organization: 'CCFF',
        category: 'CCFF Hall of Fame Inductee',
        title: 'CCFF Hall of Fame Inductee (6th CCFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
    {
      id: '15ad9102-d113-455a-b547-80f8cbddad5d', // Ali Nuhu
      award: {
        organization: 'CCFF',
        category: 'CCFF Hall of Fame Inductee',
        title: 'CCFF Hall of Fame Inductee (6th CCFF)',
        year: 2026,
        season: 2026,
        won: true,
        work: null,
      },
    },
    {
      id: '5ad25530-a640-43a1-a54f-de64c319bd9c', // Francis Duru
      award: {
        organization: 'CCFF',
        category: 'CCFF Hall of Fame Inductee',
        title: 'CCFF Hall of Fame Inductee',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: 'afe1ad3e-47e3-42ba-a048-d635723a2edf', // Sam Dede
      award: {
        organization: 'CCFF',
        category: 'CCFF Hall of Fame Inductee',
        title: 'CCFF Hall of Fame Inductee',
        year: 2024,
        season: 2024,
        won: true,
        work: null,
      },
    },
    {
      id: 'f3da5846-7d71-4ed6-a65b-aceb2a69b218', // Pete Edochie
      award: {
        organization: 'CCFF',
        category: 'Living Legend & Honorary Recognition',
        title: 'CCFF Living Legend & Honorary Icon Award',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
    {
      id: 'a1ebcd5a-75a4-4c3b-8c53-a8ea432a9176', // Patience Ozokwor
      award: {
        organization: 'CCFF',
        category: 'Living Legend & Honorary Recognition',
        title: 'CCFF Living Legend & Honorary Icon Award',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
    {
      id: '3c5172a9-f556-40f8-b656-e0ff890143a0', // Zack Orji
      award: {
        organization: 'CCFF',
        category: 'Living Legend & Honorary Recognition',
        title: 'CCFF Living Legend & Honorary Icon Award',
        year: 2023,
        season: 2023,
        won: true,
        work: null,
      },
    },
  ];

  console.log('--- Syncing CCFF People Awards ---');
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
        (a.organization === 'CCFF' || a.organization === 'Coal City Film Festival') &&
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
      console.log(`✅ Added CCFF Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  // Film awards
  const filmAwards = [
    {
      id: 'e6230a5a-6a03-41e4-bb0a-28690493b239', // Kaka
      awards: [
        {
          organization: 'CCFF',
          category: 'Best Feature Film',
          title: 'Best Feature Film - Coal City Film Festival',
          year: 2024,
          season: 2024,
          won: true,
          recipients: ['Kaka'],
        },
        {
          organization: 'CCFF',
          category: 'Best Director',
          title: 'Best Director - Coal City Film Festival',
          year: 2024,
          season: 2024,
          won: true,
          recipients: ['Kaka'],
        },
      ],
    },
  ];

  console.log('\n--- Syncing CCFF Film Awards ---');
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
          (a.organization === 'CCFF' || a.organization === 'Coal City Film Festival') &&
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
        console.log(`✅ Updated ${film.title} with ${addedCount} CCFF award(s)`);
      }
    }
  }

  console.log('\n✨ All CCFF awards synced successfully!');
}

syncCCFF().catch(console.error);
