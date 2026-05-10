import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixNeedsReview() {
  console.log('🔍 Fixing needs_review flag for youtube_buffer films...');

  const { data, error } = await supabase
    .from('films')
    .update({ needs_review: false })
    .eq('source', 'youtube_buffer')
    .eq('needs_review', true)
    .select('id');

  if (error) {
    console.error('Error updating:', error);
  } else {
    console.log(`✅ Updated ${data.length} films.`);
  }
}

fixNeedsReview().catch(console.error);
