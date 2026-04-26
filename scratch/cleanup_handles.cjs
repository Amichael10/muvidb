const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function cleanupHandles() {
  const { data, error } = await supabase
    .from('people')
    .update({ youtube_handle: null, youtube_channel_id: null })
    .in('name', ['Sola Sobowale', 'Antar Laniyan']);
  
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Successfully removed YouTube data from non-channel profiles.');
  }
}

cleanupHandles();
