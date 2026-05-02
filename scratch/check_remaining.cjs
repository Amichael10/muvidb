const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkRemaining() {
  // Check remaining films without backdrop
  const { count: noBackdrop } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .not('poster_url', 'is', null)
    .neq('poster_url', '')
    .or('backdrop_url.is.null,backdrop_url.eq.""');
  
  console.log('Films still missing backdrop:', noBackdrop);

  // Check remaining dirty YouTube titles
  const { count: ytFilms } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .not('youtube_watch_url', 'is', null)
    .neq('youtube_watch_url', '');

  console.log('Total films with youtube_watch_url:', ytFilms);

  // Totals
  const { count: total } = await supabase.from('films').select('*', { count: 'exact', head: true });
  console.log('Total films in DB:', total);
}

checkRemaining().catch(console.error);
