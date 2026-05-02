
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYoutubeShowtimes() {
  const { data, error } = await supabase
    .from('showtimes')
    .select('id, film_id, films(title, source)')
    .eq('films.source', 'youtube');

  if (error) {
    console.error('Error fetching youtube showtimes:', error);
    return;
  }
  
  const filtered = data.filter(s => s.films?.source === 'youtube');
  console.log('Number of showtimes for YouTube movies:', filtered.length);
  if (filtered.length > 0) {
    console.log('Sample YouTube movie with showtimes:', filtered[0]);
  }
}

checkYoutubeShowtimes();
