const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSpotlight() {
  const { data, error } = await supabase
    .from('people')
    .select('id, name, is_spotlight, youtube_handle')
    .eq('is_spotlight', true);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Spotlight People:', data);
}

checkSpotlight();
