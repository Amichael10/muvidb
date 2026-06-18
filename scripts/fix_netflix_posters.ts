import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('Fetching netflix films...');
  const { data, error } = await supabase
    .from('films')
    .select('id, title, poster_url, backdrop_url')
    .eq('source', 'netflix');

  if (error) {
    console.error('Error fetching:', error);
    return;
  }

  console.log(`Found ${data.length} netflix films.`);
  
  let updatedCount = 0;
  for (const film of data) {
    if (film.backdrop_url && film.poster_url !== film.backdrop_url) {
      const { error: updateError } = await supabase
        .from('films')
        .update({ poster_url: film.backdrop_url })
        .eq('id', film.id);
        
      if (updateError) {
        console.error(`Failed to update ${film.title}:`, updateError);
      } else {
        updatedCount++;
        console.log(`Updated ${film.title}`);
      }
    }
  }
  
  console.log(`Successfully updated ${updatedCount} films.`);
}

run();
