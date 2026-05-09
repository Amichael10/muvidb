import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanup() {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  console.log(`🧹 Cleaning up empty films added after ${oneHourAgo}...`);
  
  const { data, error } = await supabase.from('films')
    .delete()
    .gt('created_at', oneHourAgo)
    .or('synopsis.is.null,synopsis.eq.""')
    .or('poster_url.is.null,poster_url.eq.""')
    .select();

  if (error) {
    console.error('❌ Error during cleanup:', error.message);
  } else {
    console.log(`✅ Deleted ${data?.length || 0} empty films.`);
  }
}

cleanup();
