import { supabase } from './lib/db';

async function syncOAFP() {
  console.log('🎬 Starting OAFP (Odunlade Adekola Films Production Awards) Sync...\n');

  // People awards
  const peopleAwards = [
    {
      id: 'cf42189a-4358-4f63-8d08-060d968f9871', // Peju Ogunmola
      award: {
        organization: 'OAFP',
        category: 'Lifetime Achievement & Industry Icon Tribute',
        title: 'Lifetime Achievement & Industry Icon Tribute - OAFP Awards 2025',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: 'cf3ce7ee-2323-4420-9db4-d25ba15c2a43', // Mide Martins
      award: {
        organization: 'OAFP',
        category: 'Best Actress',
        title: 'Best Actress - OAFP Awards 2025',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: '68ba4115-c408-4b6b-bf72-de4c79c6591e', // Eniola Ajao
      award: {
        organization: 'OAFP',
        category: 'OAFP Star Ambassador & Excellence Award',
        title: 'OAFP Star Ambassador & Excellence Award - OAFP Awards 2025',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: '7b73590a-da14-4912-82c2-3688fa865aa9', // Ibrahim Chatta
      award: {
        organization: 'OAFP',
        category: 'Special Recognition for Cinematic Excellence',
        title: 'Special Recognition for Cinematic Excellence - OAFP Awards 2025',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
    {
      id: 'e94516c3-f156-4c07-9780-5b2be647adb5', // Lateef Adedimeji
      award: {
        organization: 'OAFP',
        category: 'Special Recognition for Cinematic Excellence',
        title: 'Special Recognition for Cinematic Excellence - OAFP Awards',
        year: 2024,
        season: 2024,
        won: true,
        work: null,
      },
    },
    {
      id: 'd079d9ea-b40f-4c4b-8563-f2f7a58da0b4', // Bukunmi Oluwashina
      award: {
        organization: 'OAFP',
        category: 'OAFP Trailblazer & Youth Icon Award',
        title: 'OAFP Trailblazer & Youth Icon Award - OAFP Awards',
        year: 2024,
        season: 2024,
        won: true,
        work: null,
      },
    },
    {
      id: '58fcc995-074e-4b4a-a6ca-f9574bb5b813', // Femi Adebayo
      award: {
        organization: 'OAFP',
        category: 'Industry Pillar & Special Recognition Award',
        title: 'Industry Pillar & Special Recognition - OAFP Awards 2025',
        year: 2025,
        season: 2025,
        won: true,
        work: null,
      },
    },
  ];

  console.log('--- Syncing OAFP People Awards ---');
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
        (a.organization === 'OAFP' || a.organization === 'Odunlade Adekola Films Production') &&
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
      console.log(`✅ Added OAFP Award to ${person.name}: ${item.award.category} (${item.award.year})`);
    }
  }

  console.log('\n✨ All OAFP awards synced successfully!');
}

syncOAFP().catch(console.error);
