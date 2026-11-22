import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
);

interface PersonAward {
  award: string;
  year: number;
  category: string;
  film_title?: string;
  won: boolean;
  notes?: string;
}

const EKO_HONOREES: { name: string; awards: PersonAward[] }[] = [
  {
    name: 'Temidayo Akinboro',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2024,
        category: 'Eko Next Rated Actor of the Year',
        film_title: 'The Origin: Madam Koi-Koi / The Oratory',
        won: false,
        notes: 'Official Nominee at the 4th Annual Eko Heritage Awards'
      }
    ]
  },
  {
    name: 'Chuks Joseph',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2023,
        category: 'Eko Next Rated Actor of the Year',
        film_title: 'Afamefuna / Dark October',
        won: true,
        notes: 'Winner at the 3rd Annual Eko Heritage Awards'
      }
    ]
  },
  {
    name: 'Deyemi Okanlawon',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2023,
        category: 'Eko Heritage Screen Icon & Cultural Ambassador',
        won: true,
        notes: 'Honored for outstanding contributions to Nollywood cinema and Lagos cultural theatre'
      }
    ]
  },
  {
    name: 'Osas Ighodaro',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2022,
        category: 'Eko Actress of the Year',
        film_title: 'Man of God / The Smart Money Woman',
        won: true,
        notes: 'Winner for Lead Screen Performance'
      }
    ]
  },
  {
    name: 'Mercy Aigbe',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2023,
        category: 'Eko Indigenous Film Producer of the Year',
        film_title: 'Ada Omo Daddy',
        won: true,
        notes: 'Winner for championing indigenous cinema in Lagos'
      }
    ]
  },
  {
    name: 'Kayode Kasum',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2023,
        category: 'Eko Filmmaker / Director of the Year',
        film_title: 'Something Like Gold / Afamefuna',
        won: true,
        notes: 'Winner for Directorial Ingenuity and Box Office Excellence'
      }
    ]
  },
  {
    name: 'Nancy Isime',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2022,
        category: 'Eko Heritage Screen Vanguard Award',
        won: true,
        notes: 'Recognized for Media, Film & Cultural Vanguard leadership'
      }
    ]
  },
  {
    name: 'Iyabo Ojo',
    awards: [
      {
        award: 'Eko Heritage Awards',
        year: 2021,
        category: 'Eko Cultural & Film Trailblazer Award',
        won: true,
        notes: 'Inaugural Special Recognition for Nollywood Cinema & Cultural Impact'
      }
    ]
  }
];

async function applyEkoAwards() {
  console.log('=== Ingesting Eko Heritage Awards (EHA) ===');

  for (const item of EKO_HONOREES) {
    const { data: person } = await supabase
      .from('people')
      .select('id, name, awards')
      .ilike('name', item.name)
      .maybeSingle();

    if (!person) {
      console.warn(`Person not found: ${item.name}`);
      continue;
    }

    const currentAwards = Array.isArray(person.awards) ? person.awards : [];
    
    // Merge without duplicates
    const merged = [...currentAwards];
    for (const newAward of item.awards) {
      const exists = merged.some(
        (a: any) =>
          a &&
          a.award === newAward.award &&
          a.year === newAward.year &&
          a.category === newAward.category
      );
      if (!exists) {
        merged.push(newAward);
        console.log(`+ Added ${newAward.category} (${newAward.year}) to ${person.name}`);
      } else {
        console.log(`= Already recorded for ${person.name}: ${newAward.category}`);
      }
    }

    const { error } = await supabase
      .from('people')
      .update({ awards: merged, updated_at: new Date().toISOString() })
      .eq('id', person.id);

    if (error) {
      console.error(`Error updating awards for ${person.name}:`, error.message);
    } else {
      console.log(`Successfully synced awards for ${person.name} (Total: ${merged.length})`);
    }
  }

  console.log('=== Finished Ingesting Eko Heritage Awards ===');
}

applyEkoAwards();
