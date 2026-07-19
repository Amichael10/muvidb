import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env.local
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
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
  console.log("Starting sourced People Enrichment batch...");
  await updateStatus('actor_enricher', 'running', 'Building 5 sourced profile proposals...');

  try {
    const { count, error: countError } = await supabase
      .from('people_enrichment_queue')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed']);
    if (countError) throw countError;
    if (!count) {
      const { error: refreshError } = await supabase.rpc('refresh_people_enrichment_queue');
      if (refreshError) throw refreshError;
    }

    // Dynamic import happens after dotenv is loaded, so the shared server client
    // receives the same service-role environment as this daemon.
    const { processPeopleEnrichmentBatch } = await import('../api/_lib/people_enrichment.js');
    const results = await processPeopleEnrichmentBatch({ limit: 5 });
    const ready = results.filter((result: any) => result.status === 'ready').length;
    const review = results.filter((result: any) => result.status === 'needs_review').length;
    const noMatch = results.filter((result: any) => result.status === 'no_match').length;
    const failed = results.filter((result: any) => result.status === 'failed').length;
    await updateStatus(
      'actor_enricher',
      'idle',
      `Prepared ${results.length} proposals: ${ready} ready, ${review} review, ${noMatch} no match, ${failed} failed`,
    );

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
        description: item.snippet.description
      });
    }

    if (newChannels.length > 0) {
      const { error: insertError } = await supabase.from('channels').insert(newChannels);
      if (insertError) {
        console.error("Insert Error details:", insertError);
        throw new Error(`Failed to insert channels: ${insertError.message}`);
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
    // Keep the source lookup deliberate: 5 profiles every 10 minutes.
    console.log("People Enrichment sleeping for 10 minutes...");
    await sleep(10 * 60 * 1000);
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
console.log("   MUVIDB AUTOMATION DAEMON INITIALIZED");
console.log("==========================================");
startActorEnricherLoop();
startChannelFetcherLoop();
