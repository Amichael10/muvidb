
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMismatch() {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, source, release_type')
    .eq('release_type', 'cinema')
    .eq('source', 'youtube');

  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Films with release_type=cinema and source=youtube:', data.length);
}

checkMismatch();
