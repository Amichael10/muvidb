const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkFeatured() {
  const { data, error } = await supabase
    .from('films')
    .select('id, title, is_featured')
    .eq('is_featured', true);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Featured Films:', data);
}

checkFeatured();
