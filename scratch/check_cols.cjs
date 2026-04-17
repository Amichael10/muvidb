const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data: films, error: filmErr } = await supabase.from('films').select('*').limit(1);
  if (filmErr) console.error('Film error:', filmErr);
  else console.log('Film columns:', Object.keys(films[0] || {}));

  const { data: people, error: peopleErr } = await supabase.from('people').select('*').limit(1);
  if (peopleErr) console.error('People error:', peopleErr);
  else console.log('People columns:', Object.keys(people[0] || {}));
}

checkSchema();
