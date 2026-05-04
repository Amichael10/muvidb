const fetch = require('node-fetch');
require('dotenv').config({ path: '.env' });

const YT_KEY = process.env.YOUTUBE_API_KEY;
const YT_BASE = 'https://www.googleapis.com/youtube/v3';

async function testChannel(channelId) {
  console.log(`🔍 Testing channel: ${channelId}`);
  const url = `${YT_BASE}/channels?part=snippet,contentDetails,statistics,brandingSettings&id=${channelId}&key=${YT_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  
  if (data.items && data.items.length > 0) {
    const item = data.items[0];
    console.log('Name:', item.snippet.title);
    console.log('Logo (High):', item.snippet.thumbnails?.high?.url);
    console.log('Banner (External):', item.brandingSettings?.image?.bannerExternalUrl);
    console.log('Banner (Mobile):', item.brandingSettings?.image?.bannerMobileImageUrl);
    console.log('Branding Settings:', JSON.stringify(item.brandingSettings, null, 2));
  } else {
    console.log('No channel found.');
  }
}

// Test with Damilola Omotoso TV (UCrJByMxvihoBEnGrzjMSZ_g - from previous logs)
testChannel('UCrJByMxvihoBEnGrzjMSZ_g');
