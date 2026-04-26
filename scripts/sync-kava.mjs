import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!FIRECRAWL_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing environment variables. Need FIRECRAWL_API_KEY, SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  console.log('🚀 Starting Kava Scrape via GitHub Actions...');

  try {
    // 1. Ensure Kava Channel exists
    let { data: channel } = await supabase.from('channels').select('id').eq('name', 'Kava Data').maybeSingle();
    
    if (!channel) {
      console.log('Creating Kava Data channel...');
      const { data: newChannel, error } = await supabase.from('channels').insert([{ 
        name: 'Kava Data', 
        channel_handle: 'kava.tv',
        is_active: true 
      }]).select().single();
      
      if (error) throw error;
      channel = newChannel;
    }

    // 2. Scrape Kava
    console.log('Fetching data from Firecrawl (this may take a minute)...');
    const scrapeRes = await fetch('https://api.firecrawl.dev/v1/extract', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: ['https://kava.tv/category/p1'],
        prompt: 'Extract all movie titles and their short synopses from this movie listing page.',
        schema: {
          type: 'object',
          properties: {
            movies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  synopsis: { type: 'string' },
                  slug: { type: 'string' },
                  poster_url: { type: ['string', 'null'] }
                },
                required: ['title', 'synopsis']
              }
            }
          },
          required: ['movies']
        }
      })
    });

    if (!scrapeRes.ok) {
      const err = await scrapeRes.text();
      if (scrapeRes.status === 402) {
        console.error('⚠️ Firecrawl Error: Insufficient credits. Please check your Firecrawl account or wait for credit reset.');
        // Don't exit with error, just return so the rest of the workflow can finish if needed
        return;
      }
      throw new Error(`Firecrawl Error [${scrapeRes.status}]: ${err}`);
    }

    const json = await scrapeRes.json();
    const movies = json.data?.movies || [];
    console.log(`✅ Found ${movies.length} movies on Kava.`);

    if (movies.length === 0) return;

    // 3. Upsert into channel_videos (the admin buffer)
    const videoRows = movies.map(m => ({
      channel_id: channel.id,
      video_id: `kava-${(m.slug || m.title).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: m.title,
      description: m.synopsis,
      thumbnail_url: m.poster_url || null,
      published_at: new Date().toISOString(),
      match_status: 'unmatched'
    }));

    const { error: upsertError } = await supabase.from('channel_videos').upsert(videoRows, { 
      onConflict: 'channel_id,video_id' 
    });

    if (upsertError) throw upsertError;
    console.log(`✨ Successfully synced ${videoRows.length} items to the buffer.`);

  } catch (err) {
    console.error('❌ Sync Failed:', err.message);
    process.exit(1);
  }
}

run();
