import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// High-confidence Golden Stars Awards and BON Nollywood Awards records
const GOLDEN_STARS_AWARDS_DATA = [
  {
    personName: 'Mide Martins',
    organization: 'GOLDEN_STARS',
    category: 'Nollywood Actress of the Year',
    title: 'Nollywood Actress of the Year',
    year: 2023,
    season: 2023,
    won: true,
    work: null,
  },
  {
    personName: 'Hazel Oyeze Onou', // Whitemoney
    altNames: ['Whitemoney'],
    organization: 'GOLDEN_STARS',
    category: 'Entertainment Sensation of the Year',
    title: 'Entertainment Sensation of the Year',
    year: 2023,
    season: 2023,
    won: true,
    work: null,
  },
  {
    personName: 'Femi Adebayo',
    organization: 'BON',
    category: 'Best Actor in a Lead Role (Overall)',
    title: 'Jagun Jagun',
    year: 2024,
    season: 2024,
    won: true,
    work: 'Jagun Jagun',
  },
  {
    personName: 'Mercy Aigbe',
    organization: 'BON',
    category: 'Best Supporting Actress',
    title: 'Ada Omo Daddy',
    year: 2024,
    season: 2024,
    won: true,
    work: 'Ada Omo Daddy',
  },
  {
    personName: 'Keppy Ekpenyong',
    organization: 'BON',
    category: 'Best Supporting Actor',
    title: 'The Weekend',
    year: 2024,
    season: 2024,
    won: true,
    work: 'The Weekend',
  },
];

async function syncGoldenStarsAndBonAwards() {
  console.log('🌟 Syncing Golden Stars Awards & BON Nollywood Awards to actor profiles...');

  let syncedCount = 0;

  for (const entry of GOLDEN_STARS_AWARDS_DATA) {
    const namesToSearch = [entry.personName, ...(entry.altNames || [])];
    
    let personRecord = null;
    for (const name of namesToSearch) {
      const { data } = await supabase
        .from('people')
        .select('id, name, awards')
        .ilike('name', `%${name}%`)
        .limit(1)
        .maybeSingle();

      if (data) {
        personRecord = data;
        break;
      }
    }

    if (!personRecord) {
      console.log(`⚠️ Person "${entry.personName}" not found in database, skipping...`);
      continue;
    }

    const currentAwards = Array.isArray(personRecord.awards) ? personRecord.awards : [];
    
    // Check if this award entry already exists
    const duplicate = currentAwards.some((a: any) =>
      a.organization === entry.organization &&
      a.year === entry.year &&
      a.category?.toLowerCase() === entry.category.toLowerCase()
    );

    if (duplicate) {
      console.log(`ℹ️ Award already exists for ${personRecord.name}: ${entry.organization} ${entry.year} (${entry.category})`);
      continue;
    }

    const newAward = {
      organization: entry.organization,
      category: entry.category,
      title: entry.title,
      year: entry.year,
      season: entry.season,
      won: entry.won,
      work: entry.work,
    };

    const updatedAwards = [...currentAwards, newAward];

    const { error: updateError } = await supabase
      .from('people')
      .update({ awards: updatedAwards })
      .eq('id', personRecord.id);

    if (updateError) {
      console.error(`❌ Failed to update awards for ${personRecord.name}:`, updateError.message);
    } else {
      syncedCount++;
      console.log(`✅ Attached ${entry.organization} ${entry.year} award ("${entry.category}") to ${personRecord.name}`);
    }
  }

  console.log(`\n🎉 Golden Stars & BON Awards sync complete! Attached ${syncedCount} new award(s).`);
}

syncGoldenStarsAndBonAwards().catch(console.error);
