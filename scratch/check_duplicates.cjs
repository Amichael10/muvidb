const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicates() {
  const titles = ['The Return Of Arinzo', 'Efunroye The Unicorn', 'KOKOBIOTA'];
  const { data, error } = await supabase
    .from('films')
    .select('id, title, is_featured')
    .in('title', titles);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Title Matches:', data);
}

checkDuplicates();
