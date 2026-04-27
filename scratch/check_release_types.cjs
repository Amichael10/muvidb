const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkValues() {
  const { data, error } = await supabase.from('films').select('release_type').limit(100);
  if (!error) {
    const types = [...new Set(data.map(d => d.release_type))];
    console.log('Release types:', types);
  }
}

checkValues();
