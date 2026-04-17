const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
const TMDB_API_KEY = process.env.VITE_TMDB_API_KEY;

async function refreshPerson(tmdbId) {
  console.log(`Fetching person ${tmdbId} from TMDB...`);
  try {
    const url = `https://api.themoviedb.org/3/person/${tmdbId}?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const p = await res.json();
    
    console.log(`Updating ${p.name}...`);
    const { data, error } = await supabase.from('people')
      .update({
        bio: p.biography,
        photo_url: p.profile_path ? `https://image.tmdb.org/t/p/w500${p.profile_path}` : null,
        popularity_score: Math.round(p.popularity * 100)
      })
      .eq('tmdb_id', tmdbId)
      .select();
      
    if (error) throw error;
    console.log('Success:', JSON.stringify(data?.[0], null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

refreshPerson(2010302); // Kunle Remi
