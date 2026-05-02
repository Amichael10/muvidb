
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkYoutubeUrlShowtimes() {
  const { data: films, error: err1 } = await supabase
    .from('films')
    .select('id, title, source, is_in_cinemas')
    .not('youtube_watch_url', 'is', null);

  if (err1) {
    console.error('Error fetching films with youtube_watch_url:', err1);
    return;
  }
  
  console.log('Films with youtube_watch_url:', films.length);
  
  const inCinemas = films.filter(f => f.is_in_cinemas === true);
  console.log('Films with youtube_watch_url and is_in_cinemas=true:', inCinemas.length);

  // Check showtimes for these films
  const filmIds = films.map(f => f.id);
  const { data: showtimes, error: err2 } = await supabase
    .from('showtimes')
    .select('id, film_id, source')
    .in('film_id', filmIds);

  if (err2) {
    console.error('Error fetching showtimes for youtube films:', err2);
    return;
  }
  
  console.log('Showtimes for films with youtube_watch_url:', showtimes.length);
  if (showtimes.length > 0) {
    const sample = showtimes[0];
    const film = films.find(f => f.id === sample.film_id);
    console.log('Sample match:', { film, showtime_source: sample.source });
  }
}

checkYoutubeUrlShowtimes();
