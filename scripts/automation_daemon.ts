import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SEARCH_QUERIES = [
  "Nollywood full movies",
  "Nigerian movies 2026 latest",
  "Yoruba movies full",
  "Official African movies",
  "Igbo movies full",
  "Nollywood romance movies",
  "Nollywood action movies"
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function updateStatus(id: string, status: string, message: string) {
  try {
    await supabase.from('automation_jobs').upsert({
      id,
      status,
      last_message: message,
      last_run: new Date().toISOString()
    });
    console.log(`[${id}] ${status}: ${message}`);
  } catch (e) {
    console.error(`Failed to update status for ${id}:`, e);
  }
}

async function runActorEnricher() {
  if (!GEMINI_API_KEY) {
    await updateStatus('actor_enricher', 'error', 'GEMINI_API_KEY is missing');
    return;
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }]
  });

  console.log("Starting Actor Enricher Batch...");
  await updateStatus('actor_enricher', 'running', 'Fetching batch of 20 actors...');

  try {
    // Process 20 at a time (much faster than Vercel's 5)
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name')
      .or('bio.is.null,photo_url.is.null')
      .limit(20);

    if (error) throw error;

    if (!people || people.length === 0) {
      await updateStatus('actor_enricher', 'idle', 'Finished: No actors missing details.');
      return; // Stop processing for now
    }

    let processedCount = 0;
    let errorsCount = 0;

    for (const person of people) {
      const prompt = `You are an expert Nollywood film historian with access to Google Search.
Your task is to search the web for accurate biographical details about the Nollywood actor/filmmaker "${person.name}".
Use your Google Search tool to find recent and accurate information, then extract their details and return it as a structured JSON object.
Rules:
- Write a compelling, 2-3 paragraph professional biography based on what you find online.
- Do NOT hallucinate. Only use facts present in your search results or from your deep knowledge of famous Nollywood actors.
- If you find an image URL representing them online (e.g. from Wikipedia, IMDb, or a news article), provide it.
- If a field cannot be reliably determined from your searches, return null.

IMPORTANT: You must return ONLY raw JSON matching this structure:
{
  "bio": "string or null",
  "date_of_birth": "YYYY-MM-DD or null",
  "birthplace": "string or null",
  "photo_url": "string or null"
}
Do NOT include markdown formatting or backticks around the JSON.

Please execute a search for: "${person.name} Nollywood actor biography date of birth"`;

      let responseText = "";
      let retries = 3;
      while (retries > 0) {
        try {
          const result = await model.generateContent(prompt);
          responseText = result.response.text();
          break;
        } catch (err: any) {
          if (err.message?.includes('503') && retries > 1) {
            console.log(`Rate limit or 503 hit. Retrying for ${person.name}...`);
            await sleep(5000); // Wait 5s on 503 since we're in a daemon
            retries--;
          } else {
            throw err;
          }
        }
      }

      responseText = responseText.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();

      let extractedData;
      try {
        extractedData = JSON.parse(responseText);
      } catch (jsonErr) {
        extractedData = {
          bio: responseText.length > 50 ? responseText : null,
          date_of_birth: null,
          birthplace: null,
          photo_url: null
        };
      }

      const { error: updateError } = await supabase
        .from('people')
        .update({
          bio: extractedData.bio || null,
          date_of_birth: extractedData.date_of_birth || null,
          birthplace: extractedData.birthplace || null,
          photo_url: extractedData.photo_url || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', person.id);

      if (updateError) {
        errorsCount++;
      } else {
        processedCount++;
      }
      
      // Small pause between individual actors to prevent overwhelming the DB/API
      await sleep(1000);
    }

    await updateStatus('actor_enricher', 'idle', `Success: Processed ${processedCount} actors (${errorsCount} errors)`);

  } catch (error: any) {
    await updateStatus('actor_enricher', 'error', `Error: ${error.message}`);
  }
}

async function runChannelFetcher() {
  if (!YOUTUBE_API_KEY) {
    await updateStatus('channel_fetcher', 'error', 'YOUTUBE_API_KEY is missing');
    return;
  }

  await updateStatus('channel_fetcher', 'running', 'Searching YouTube...');

  try {
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
      await updateStatus('channel_fetcher', 'idle', `Found 0 new channels for query: "${query}"`);
      return;
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
      const { error: insertError } = await supabase.from('channels').insert(newChannels);
      if (insertError) {
        throw new Error("Failed to insert channels into database");
      }
    }

    await updateStatus('channel_fetcher', 'idle', `Success: Found ${newChannels.length} new channels from query: "${query}"`);

  } catch (error: any) {
    await updateStatus('channel_fetcher', 'error', `Error: ${error.message}`);
  }
}

// ==========================================
// DAEMON MAIN LOOPS
// ==========================================

async function startActorEnricherLoop() {
  console.log("Starting Actor Enricher Daemon Loop...");
  while (true) {
    await runActorEnricher();
    // Wait 60 seconds between batches to avoid spamming Gemini paid quotas excessively
    console.log("Actor Enricher sleeping for 60 seconds...");
    await sleep(60 * 1000);
  }
}

async function startChannelFetcherLoop() {
  console.log("Starting Channel Fetcher Daemon Loop...");
  while (true) {
    await runChannelFetcher();
    // Wait 2 hours between channel queries
    console.log("Channel Fetcher sleeping for 2 hours...");
    await sleep(2 * 60 * 60 * 1000);
  }
}

// Start Both
console.log("==========================================");
console.log("   LUMI AUTOMATION DAEMON INITIALIZED");
console.log("==========================================");
startActorEnricherLoop();
startChannelFetcherLoop();
