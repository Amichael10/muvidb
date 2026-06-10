import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !YOUTUBE_API_KEY) {
  console.error("Missing required environment variables. Check your .env file.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const SEARCH_QUERIES = [
  "Nollywood full movies",
  "Nigerian movies 2026 latest",
  "Yoruba movies full",
  "Official African movies",
  "Igbo movies full",
  "Nollywood romance movies",
  "Nollywood action movies"
];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function findNollywoodChannels() {
  console.log("🎬 Starting YouTube Nollywood Channel Discovery...");

  // 1. Fetch existing channels from DB so we don't duplicate
  const { data: existingChannels, error } = await supabase.from('channels').select('channel_id');
  if (error) {
    console.error("Error fetching existing channels:", error.message);
    return;
  }
  const existingChannelIds = new Set(existingChannels?.map(c => c.channel_id) || []);
  console.log(`✅ Loaded ${existingChannelIds.size} existing channels from database.`);

  const discoveredChannels = new Map<string, any>();

  // 2. Search YouTube API for channels matching our queries
  for (const query of SEARCH_QUERIES) {
    console.log(`\n🔍 Searching YouTube for: "${query}"...`);
    
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=50&key=${YOUTUBE_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error("YouTube API Error:", data.error.message);
        continue;
      }

      if (!data.items) {
        console.log("No channels found for this query.");
        continue;
      }

      let newCount = 0;
      for (const item of data.items) {
        const channelId = item.snippet.channelId;
        const title = item.snippet.title;
        const description = item.snippet.description;

        // Skip if we already have it in DB or if we already discovered it in this run
        if (existingChannelIds.has(channelId)) continue;
        if (discoveredChannels.has(channelId)) continue;

        discoveredChannels.set(channelId, {
          channel_id: channelId,
          name: title,
          description: description,
          source: 'youtube',
          discovered_via_query: query
        });
        newCount++;
      }
      
      console.log(`Found ${newCount} NEW potential channels from this query.`);
      
    } catch (err) {
      console.error(`Request failed for query "${query}":`, err);
    }
    
    // Respect API rate limits
    await sleep(1000);
  }

  // 3. Save discovered channels to JSON
  const channelsArray = Array.from(discoveredChannels.values());
  console.log(`\n🎉 Discovery complete! Found a total of ${channelsArray.length} new potential channels.`);
  
  if (channelsArray.length > 0) {
    fs.writeFileSync('discovered_channels.json', JSON.stringify(channelsArray, null, 2));
    console.log(`📁 Saved results to 'discovered_channels.json'. Please review them before importing!`);
  } else {
    console.log("No new channels to save.");
  }
}

findNollywoodChannels().catch(console.error);
