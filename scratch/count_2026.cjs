const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function count2026() {
  const { count, error } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('year', 2026);
  
  if (!error) {
    console.log('Count of 2026 films:', count);
  } else {
    console.log('Error:', error);
  }
}

count2026();
