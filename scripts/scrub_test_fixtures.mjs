import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing Supabase URL or Service Role Key in environment');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function scrub() {
  console.log('Scrubbing all dummy test fixtures from database...\n');

  // Find test company
  const { data: comp } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', 'apex-prime-studios-test')
    .maybeSingle();

  if (comp) {
    console.log('1. Deleting company representations...');
    await supabase.from('talent_representations').delete().eq('company_id', comp.id);

    console.log('2. Deleting company film links...');
    await supabase.from('film_companies').delete().eq('company_id', comp.id);

    console.log('3. Deleting company claims...');
    await supabase.from('company_claims').delete().eq('company_id', comp.id);

    console.log('4. Deleting company...');
    await supabase.from('companies').delete().eq('id', comp.id);
  }

  // Find test films
  const testFilmSlugs = ['lagos-heatwave-test', 'gold-coast-heist-test'];
  const { data: films } = await supabase
    .from('films')
    .select('id')
    .in('slug', testFilmSlugs);

  if (films && films.length > 0) {
    const filmIds = films.map(f => f.id);
    console.log('5. Deleting credits for test films...');
    await supabase.from('credits').delete().in('film_id', filmIds);

    console.log('6. Deleting test films...');
    await supabase.from('films').delete().in('id', filmIds);
  }

  // Find test talents
  const testPeopleSlugs = [
    'korede-vance-test',
    'amara-okon-test',
    'tunde-balogun-test',
    'ngozi-adeleke-test'
  ];
  console.log('7. Deleting test people...');
  await supabase.from('people').delete().in('slug', testPeopleSlugs);

  console.log('\nAll dummy test fixtures scrubbed successfully!');
}

scrub().catch(err => {
  console.error('Scrub script error:', err);
  process.exit(1);
});
