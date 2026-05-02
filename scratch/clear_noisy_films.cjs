const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearNoisyFilms() {
  console.log('Fetching films needing review...');
  
  // We have to delete in chunks since postgrest limits apply
  let totalDeleted = 0;
  
  while (true) {
    const { data: films, error } = await supabase
      .from('films')
      .select('id')
      .eq('needs_review', true)
      .limit(500);
      
    if (error) {
      console.error('Error fetching films:', error);
      break;
    }
    
    if (!films || films.length === 0) {
      console.log('No more films needing review.');
      break;
    }
    
    const ids = films.map(f => f.id);
    
    console.log(`Deleting chunk of ${ids.length} films...`);
    
    const { error: deleteError } = await supabase
      .from('films')
      .delete()
      .in('id', ids);
      
    if (deleteError) {
      console.error('Error deleting films:', deleteError);
      break;
    }
    
    totalDeleted += ids.length;
    console.log(`Deleted ${totalDeleted} films so far...`);
  }
  
  console.log(`Finished clearing films. Total deleted: ${totalDeleted}`);
}

clearNoisyFilms();
