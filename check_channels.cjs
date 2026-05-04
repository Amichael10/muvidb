const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pkenrmorywmuvnzfoylp.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseKey) {
  console.error('Missing Supabase Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkChannels() {
  console.log('🔍 Checking Channels table...');
  
  const { data: channels, error } = await supabase
    .from('channels')
    .select('id, name, channel_id, thumbnail_url, banner_url, videos_last_fetched_at')
    .order('videos_last_fetched_at', { ascending: false });

  if (error) {
    console.error('Error fetching channels:', error);
    return;
  }

  console.log(`Found ${channels.length} channels.`);
  
  const brokenLogos = channels.filter(c => !c.thumbnail_url || c.thumbnail_url.includes('yt3.ggpht.com') === false);
  const brokenBanners = channels.filter(c => !c.banner_url);
  
  console.log(`Channels with missing/weird logos: ${brokenLogos.length}`);
  console.log(`Channels with missing banners: ${brokenBanners.length}`);
  
  if (channels.length > 0) {
    console.log('\nSample channels (Top 5 most recently synced):');
    channels.slice(0, 5).forEach(c => {
      console.log(`- ${c.name} (${c.channel_id}):
        Logo: ${c.thumbnail_url}
        Banner: ${c.banner_url}
        Last Sync: ${c.last_sync_at}`);
    });
    
    console.log('\nSample channels with missing banners:');
    brokenBanners.slice(0, 5).forEach(c => {
      console.log(`- ${c.name} (${c.channel_id})`);
    });
  }
}

checkChannels();
