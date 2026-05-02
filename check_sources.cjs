
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSources() {
  const { data, error } = await supabase.from('films').select('source');
  if (error) {
    console.error('Error fetching sources:', error);
    return;
  }
  const sources = [...new Set(data.map(f => f.source))];
  console.log('Unique sources in films table:', sources);
  
  // Count by source
  const counts = {};
  data.forEach(f => {
    const s = f.source || 'null';
    counts[s] = (counts[s] || 0) + 1;
  });
  console.log('Counts by source:', counts);
}

checkSources();
