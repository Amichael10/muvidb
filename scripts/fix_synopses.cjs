const fs = require('fs');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const supabase = createClient(all.VITE_SUPABASE_URL || all.SUPABASE_URL, all.SUPABASE_SERVICE_ROLE_KEY);

async function clean() {
  await supabase.from('films').update({
    synopsis: "A woman married to a multi-millionaire is accused of her husband's murder and subsequently tried in court, unraveling a high-stakes web of deceit, greed, and hidden family motives.",
    runtime_minutes: 95
  }).eq('imdb_id', 'tt8346640');

  await supabase.from('films').update({
    synopsis: "Kinta's sons escape from an invasion, but in the chaos, they separate from each other, and decades pass before they know what happened to one another."
  }).eq('imdb_id', 'tt21352098');

  console.log('Cleaned up synopses successfully!');
}

clean().catch(console.error);
