
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkShowtimes() {
  const { data, error } = await supabase.from('showtimes').select('*').limit(1);
  if (error) {
    console.error('Error fetching showtimes:', error);
    return;
  }
  if (data.length === 0) {
    console.log('No showtimes found.');
    return;
  }
  console.log('Columns in showtimes table:');
  console.log(Object.keys(data[0]).join(', '));
}

checkShowtimes();
