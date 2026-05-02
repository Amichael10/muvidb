
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkReleaseTypes() {
  const { data, error } = await supabase.from('films').select('release_type');
  if (error) {
    console.error('Error fetching release_types:', error);
    return;
  }
  const types = [...new Set(data.map(f => f.release_type))];
  console.log('Unique release_types:', types);
}

checkReleaseTypes();
