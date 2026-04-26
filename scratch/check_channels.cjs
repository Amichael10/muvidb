const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkHandles() {
  const { data, error } = await supabase
    .from('people')
    .select('id, name, is_spotlight, youtube_handle, youtube_channel_id')
    .or('youtube_handle.neq.null,youtube_handle.neq."",youtube_channel_id.neq.null');
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('People with potential channel info:', data);
}

checkHandles();
