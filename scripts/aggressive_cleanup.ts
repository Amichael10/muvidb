
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  console.log('--- Aggressive Cleanup ---');
  
  // Find all films missing critical data
  const { data: badFilms, error: findError } = await supabase
    .from('films')
    .select('id, title')
    .or('synopsis.is.null,poster_url.is.null');

  if (findError) {
    console.error('Error finding bad films:', findError);
    return;
  }

  console.log(`Found ${badFilms?.length} films missing synopsis or poster.`);

  if (badFilms && badFilms.length > 0) {
    const ids = badFilms.map(f => f.id);
    // Delete in chunks
    const chunkSize = 100;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error: deleteError } = await supabase
        .from('films')
        .delete()
        .in('id', chunk);
        
      if (deleteError) {
        console.error(`Error deleting chunk ${i}:`, deleteError);
      } else {
        console.log(`Deleted chunk ${i} to ${i + chunk.length}`);
      }
    }
  }

  console.log('--- Cleanup Finished ---');
}

cleanup();
