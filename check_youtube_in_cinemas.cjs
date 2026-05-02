
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYoutubeInCinemas() {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, is_in_cinemas')
    .eq('source', 'youtube')
    .eq('is_in_cinemas', true);

  if (error) {
    console.error('Error fetching youtube in_cinemas:', error);
    return;
  }
  
  console.log('Number of YouTube movies with is_in_cinemas=true:', data.length);
  if (data.length > 0) {
    console.log('Sample:', data[0]);
  }
}

checkYoutubeInCinemas();
