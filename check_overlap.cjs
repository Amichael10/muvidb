
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOverlap() {
  const { data, error } = await supabase
    .from('showtimes')
    .select(`
      id,
      film_id,
      films!inner(title, source, youtube_watch_url)
    `)
    .not('films.youtube_watch_url', 'is', null)
    .limit(10);

  if (error) {
    console.error('Error fetching overlap:', error);
    return;
  }
  
  console.log('Showtimes that link to movies with youtube_watch_url:', data.length);
  if (data.length > 0) {
    console.table(data.map(d => ({
      id: d.id,
      film_id: d.film_id,
      title: d.films?.title,
      source: d.films?.source,
      youtube: d.films?.youtube_watch_url
    })));
  }
}

checkOverlap();
