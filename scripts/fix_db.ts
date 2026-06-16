import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying movies with Part in title...');
  const { data, error } = await supabase
    .from('films')
    .select('id, title, content_type')
    .ilike('title', '%part%')
    .eq('content_type', 'series');

  console.log(`Found ${data?.length || 0} movies with Part in title currently marked as series.`);
  
  if (data && data.length > 0) {
    for (const film of data) {
      console.log(`Updating ${film.title} to movie...`);
      await supabase.from('films').update({ content_type: 'movie' }).eq('id', film.id);
    }
  }

  console.log('\nQuerying Koleoso...');
  const { data: koleosoData } = await supabase
    .from('films')
    .select('id, title, content_type')
    .ilike('title', '%koleoso%');

  console.log(`Found ${koleosoData?.length || 0} Koleoso titles.`);
  if (koleosoData) {
    for (const film of koleosoData) {
      console.log(`- ${film.title} (${film.content_type})`);
      if (film.content_type === 'movie') {
        console.log(`  Updating ${film.title} to series...`);
        await supabase.from('films').update({ content_type: 'series' }).eq('id', film.id);
      }
    }
  }
}

run();
