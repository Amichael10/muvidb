
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('--- Checking Channels ---');
  const { data: channels, error: chErr } = await supabase.from('channels').select('*').limit(5);
  if (chErr) {
    console.error('Error fetching channels:', chErr);
  } else {
    channels.forEach(ch => {
      console.log(`Channel: ${ch.name}`);
      console.log(`- Logo: ${ch.logo_url || ch.thumbnail_url}`);
      console.log(`- Backdrop: ${ch.backdrop_url}`);
      console.log(`- Last Fetched: ${ch.videos_last_fetched_at}`);
    });
  }

  console.log('\n--- Checking Sync Logs ---');
  const { data: logs, error: logErr } = await supabase
    .from('sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (logErr) {
    console.error('Error fetching logs:', logErr);
  } else {
    logs.forEach(l => {
      console.log(`[${l.created_at}] ${l.source} - ${l.status}: ${l.message}`);
    });
  }

  console.log('\n--- Checking Recent Videos ---');
  const { data: videos, error: vidErr } = await supabase
    .from('channel_videos')
    .select('title, published_at, channel_id')
    .order('published_at', { ascending: false })
    .limit(5);
  
  if (vidErr) {
    console.error('Error fetching videos:', vidErr);
  } else {
    videos.forEach(v => {
      console.log(`[${v.published_at}] ${v.title} (Channel ID: ${v.channel_id})`);
    });
  }
}

run();
