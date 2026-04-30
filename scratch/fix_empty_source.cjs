
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); // Use service role for update

async function fixEmptyStrings() {
  const { data, error } = await supabase
    .from('films')
    .update({ source_video_id: null })
    .eq('source_video_id', '');

  if (error) {
    console.error('Error fixing empty strings:', error);
  } else {
    console.log('Fixed empty strings in source_video_id');
  }
}

fixEmptyStrings();
