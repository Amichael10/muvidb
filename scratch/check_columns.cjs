const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('📋 Fetching column names for films and people...');
  
  // We can use a trick to get column names if we have service role
  // Or just try to select everything and see keys of first row
  const { data: film, error: fErr } = await supabase.from('films').select('*').limit(1).single();
  if (film) {
    console.log('Columns in [films]:', Object.keys(film).join(', '));
  } else {
    console.log('Could not get columns for [films]:', fErr?.message);
  }

  const { data: person, error: pErr } = await supabase.from('people').select('*').limit(1).single();
  if (person) {
    console.log('Columns in [people]:', Object.keys(person).join(', '));
  } else {
    console.log('Could not get columns for [people]:', pErr?.message);
  }
}

checkSchema();
