import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../_lib/supabase';

const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

const SEARCH_QUERIES = [
  "Nollywood full movies",
  "Nigerian movies 2026 latest",
  "Yoruba movies full",
  "Official African movies",
  "Igbo movies full",
  "Nollywood romance movies",
  "Nollywood action movies"
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!YOUTUBE_API_KEY) {
    await supabase.from('automation_jobs').upsert({
      id: 'channel_fetcher',
      status: 'error',
      last_message: 'YOUTUBE_API_KEY is missing',
      last_run: new Date().toISOString()
    });
    return res.status(500).json({ error: 'Missing YOUTUBE_API_KEY' });
  }

  await supabase.from('automation_jobs').upsert({
    id: 'channel_fetcher',
    status: 'running',
    last_message: 'Searching YouTube...',
    last_run: new Date().toISOString()
  });

  try {
    // Pick 1 random query per run to avoid timeouts
    const query = SEARCH_QUERIES[Math.floor(Math.random() * SEARCH_QUERIES.length)];

    const { data: existingChannels } = await supabase.from('channels').select('channel_id');
    const existingChannelIds = new Set(existingChannels?.map(c => c.channel_id) || []);

    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=50&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    if (!data.items || data.items.length === 0) {
      await supabase.from('automation_jobs').upsert({
        id: 'channel_fetcher',
        status: 'idle',
        last_message: `Found 0 new channels for query: "${query}"`,
        last_run: new Date().toISOString()
      });
      return res.status(200).json({ message: 'No channels found' });
    }

    let newChannels = [];
    for (const item of data.items) {
      const channelId = item.snippet.channelId;
      if (existingChannelIds.has(channelId)) continue;

      newChannels.push({
        channel_id: channelId,
        name: item.snippet.title,
        description: item.snippet.description,
        source: 'youtube',
        discovered_via_query: query
      });
    }

    if (newChannels.length > 0) {
      // In a real scenario, these might go into a `discovered_channels` table or directly into `channels` with is_verified=false
      // We'll assume the channels table handles it or they can just be inserted. 
      // If the schema rejects them without other fields, we catch it.
      const { error: insertError } = await supabase.from('channels').insert(newChannels);
      if (insertError) {
        console.error("Insert error:", insertError);
        // It's possible the `channels` table requires other fields not present.
        // For the sake of the script, we log the error but consider it a partial success if some logic failed.
        throw new Error("Failed to insert channels into database");
      }
    }

    await supabase.from('automation_jobs').upsert({
      id: 'channel_fetcher',
      status: 'idle',
      last_message: `Success: Found ${newChannels.length} new channels from query: "${query}"`,
      last_run: new Date().toISOString()
    });

    return res.status(200).json({ message: `Found ${newChannels.length} new channels.` });

  } catch (error: any) {
    console.error(error);
    await supabase.from('automation_jobs').upsert({
      id: 'channel_fetcher',
      status: 'error',
      last_message: `Error: ${error.message}`,
      last_run: new Date().toISOString()
    });
    return res.status(500).json({ error: error.message });
  }
}
