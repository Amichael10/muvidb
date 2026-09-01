import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const HOLLYWOOD_NAMES = [
  'Tom Cruise', 'Brad Pitt', 'Leonardo DiCaprio', 'Scarlett Johansson', 'Samuel L. Jackson',
  'Robert Downey Jr.', 'Chris Evans', 'Chris Hemsworth', 'Morgan Freeman', 'Denzel Washington',
  'Tom Hanks', 'Harrison Ford', 'Robert De Niro', 'Meryl Streep', 'Jennifer Lawrence',
  'Emma Stone', 'Kate Winslet', 'Matt Damon', 'Keanu Reeves', 'Johnny Depp', 'Will Smith',
  'Angelina Jolie', 'Anne Hathaway', 'Natalie Portman', 'Charlize Theron', 'Christian Bale',
  'Hugh Jackman', 'Ryan Reynolds', 'Ryan Gosling', 'Dwayne Johnson', 'Mark Wahlberg',
  'Vin Diesel', 'Jason Statham', 'Sylvester Stallone', 'Arnold Schwarzenegger', 'Bruce Willis',
  'Frank Welker', 'Tom Kenny', 'Dee Bradley Baker', 'Tara Strong', 'Grey DeLisle'
];

async function purgeHollywoodSeedPeople() {
  console.log('🗑️ Purging known Hollywood seed actors from people table...');

  let totalDeleted = 0;
  for (const name of HOLLYWOOD_NAMES) {
    const { data: people } = await supabase.from('people').select('id, name').ilike('name', name);
    if (people && people.length > 0) {
      for (const p of people) {
        console.log(`  Deleting: ${p.name} (${p.id})`);
        await supabase.from('credits').delete().eq('person_id', p.id);
        await supabase.from('person_media').delete().eq('person_id', p.id);
        const { error } = await supabase.from('people').delete().eq('id', p.id);
        if (error) console.error(`  Error deleting ${p.name}:`, error.message);
        else totalDeleted++;
      }
    }
  }

  console.log(`✅ Deleted ${totalDeleted} Hollywood actors from database.`);
}

purgeHollywoodSeedPeople().catch(console.error);
