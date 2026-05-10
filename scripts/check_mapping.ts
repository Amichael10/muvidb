import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDb() {
  console.log('🔍 Checking Database Mapping...');

  // Check unmapped in channel_videos
  const { count: unmappedCount } = await supabase
    .from('channel_videos')
    .select('*', { count: 'exact', head: true })
    .is('film_id', null);
  console.log(`- Unmapped in channel_videos: ${unmappedCount}`);

  // Check mapped in channel_videos
  const { count: mappedCount } = await supabase
    .from('channel_videos')
    .select('*', { count: 'exact', head: true })
    .not('film_id', 'is', null);
  console.log(`- Mapped in channel_videos: ${mappedCount}`);

  // Check films missing source
  const { count: missingSourceCount } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .is('source', null);
  console.log(`- Films missing 'source': ${missingSourceCount}`);

  // Check films missing source_video_id but are from youtube
  const { count: missingSourceVideoIdCount } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'youtube_buffer')
    .is('source_video_id', null);
  console.log(`- Films from youtube_buffer missing 'source_video_id': ${missingSourceVideoIdCount}`);

  // Update any existing films that have needs_review: true if they were from youtube_buffer (optional, let's just see how many)
  const { count: needsReviewCount } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'youtube_buffer')
    .eq('needs_review', true);
  console.log(`- Youtube buffer films needing review: ${needsReviewCount}`);
}

checkDb().catch(console.error);
