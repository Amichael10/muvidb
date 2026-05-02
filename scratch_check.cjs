
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Manual env loading to be safe
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env or .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFilms() {
  console.log('Checking movies with is_in_cinemas=true or showtimes...');
  
  // Check films with is_in_cinemas
  const { data: cinemaFlagFilms, error: err1 } = await supabase
    .from('films')
    .select('id, title, source, is_in_cinemas, available_on_platform')
    .eq('is_in_cinemas', true)
    .limit(10);
    
  if (err1) console.error('Error fetching cinemaFlagFilms:', err1);
  else {
    console.log('\n--- Films with is_in_cinemas = true ---');
    console.table(cinemaFlagFilms);
  }

  // Check showtimes
  const today = new Date().toISOString().split('T')[0];
  const { data: showtimes, error: err2 } = await supabase
    .from('showtimes')
    .select('id, film_id, films(title, source), cinema_id, is_available')
    .gte('show_date', today)
    .limit(10);

  if (err2) console.error('Error fetching showtimes:', err2);
  else {
    console.log('\n--- Active Showtimes ---');
    const flattened = showtimes.map(s => ({
      id: s.id,
      film_id: s.film_id,
      title: s.films?.title,
      source: s.films?.source,
      cinema_id: s.cinema_id,
      is_available: s.is_available
    }));
    console.table(flattened);
  }
  
  // Check YouTube movies specifically
  const { data: youtubeFilms, error: err3 } = await supabase
    .from('films')
    .select('id, title, is_in_cinemas, available_on_platform, source')
    .eq('source', 'youtube')
    .limit(10);

  if (err3) console.error('Error fetching youtubeFilms:', err3);
  else {
    console.log('\n--- YouTube Films Example ---');
    console.table(youtubeFilms);
  }
}

checkFilms();
