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
                  url: { type: 'string', description: 'The absolute URL to watch this movie' },
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

    // Fetch existing Kava films to avoid inserting duplicates
    const { data: existingFilms } = await supabase
      .from('films')
      .select('source_video_id')
      .eq('source', 'kava');
    const existingSet = new Set(existingFilms?.map(f => f.source_video_id) || []);

    // 3. Insert into films
    const filmsToUpsert = movies.map(m => {
      const source_video_id = `kava-${m.slug || m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      const watchUrl = m.url || `https://kava.tv/watch/${m.slug}`;
      return {
        title: m.title,
        synopsis: m.synopsis,
        poster_url: m.poster_url,
        backdrop_url: m.poster_url,
        source: 'kava',
        source_video_id,
        youtube_watch_url: watchUrl,
        release_type: 'kava',
        countries: ['Nigeria'],
        needs_review: false
      };
    }).filter(row => !existingSet.has(row.source_video_id));

    let inserted = 0;
    let errors = 0;
    
    for (const film of filmsToUpsert) {
      const { error } = await supabase.from('films').insert([film]);
      if (error) {
        console.error(`Error inserting ${film.title}:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    }

    console.log(`✨ Successfully synced ${inserted} new items to films. Errors: ${errors}.`);

  } catch (err) {
    console.error('❌ Sync Failed:', err.message);
    process.exit(1);
  }
}

run();
