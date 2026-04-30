const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase credentials. Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1'
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const randomDelay = (min = 2000, max = 5000) => delay(Math.floor(Math.random() * (max - min + 1) + min));

async function getNextData(slug) {
  const url = `https://mubi.com/en/cast/${slug}`;
  console.log(`[HTTP] GET ${url}`);
  try {
    const response = await fetch(url, { headers: HEADERS });
    
    if (response.status === 404) {
      console.log(`[HTTP] 404 Not Found for ${slug}`);
      return null;
    }
    
    if (response.status === 429) {
      console.warn(`[HTTP] 429 Too Many Requests for ${slug}. Backing off...`);
      await delay(30000); // 30 second backoff
      return getNextData(slug);
    }
    
    if (!response.ok) {
      console.error(`[HTTP] Error ${response.status} for ${slug}`);
      return null;
    }
    
    const html = await response.text();
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/);
    
    if (nextDataMatch && nextDataMatch[1]) {
      return JSON.parse(nextDataMatch[1]);
    }
    return null;
  } catch (error) {
    console.error(`[HTTP] Request failed for ${slug}:`, error.message);
    return null;
  }
}

async function processPerson(person) {
  if (!person.mubi_slug) {
    console.log(`[SKIP] Person ${person.id} has no Mubi slug.`);
    return;
  }

  console.log(`[PROCESS] Enriching ${person.name} (${person.mubi_slug})...`);
  
  const data = await getNextData(person.mubi_slug);
  if (!data) {
    console.log(`[SKIP] Could not extract data for ${person.mubi_slug}`);
    return;
  }

  const castMemberData = data.props?.pageProps?.castMember;
  if (!castMemberData) {
    console.log(`[SKIP] No castMember object found in Next data for ${person.mubi_slug}`);
    return;
  }

  // Update data
  let photoUrl = null;
  if (castMemberData.image_url) {
      photoUrl = castMemberData.image_url.replace('{size}', 'original');
  }

  let bio = null;
  if (castMemberData.biography) {
      bio = castMemberData.biography;
  }

  if (photoUrl || bio) {
    const updatePayload = {};
    if (photoUrl && !person.photo_url) updatePayload.photo_url = photoUrl;
    if (bio && !person.bio) updatePayload.bio = bio;

    if (Object.keys(updatePayload).length > 0) {
      updatePayload.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from('people')
        .update(updatePayload)
        .eq('id', person.id);
        
      if (error) {
        console.error(`[DB ERROR] Failed to update ${person.name}:`, error.message);
      } else {
        console.log(`[DB SUCCESS] Updated ${person.name} with ${Object.keys(updatePayload).join(', ')}`);
      }
    } else {
      console.log(`[SKIP] ${person.name} already has photo and bio.`);
    }
  } else {
      console.log(`[SKIP] No new photo or bio found for ${person.name}.`);
  }
}

async function runEnrichment() {
  console.log('--- STARTING CAST ENRICHMENT ---');
  
  // 1. Fetch people that have a mubi_slug but are missing photo_url or bio
  // By querying our own DB, we ensure we only scrape people associated with the African films we've ingested.
  const { data: peopleToEnrich, error } = await supabase
    .from('people')
    .select('id, name, mubi_slug, photo_url, bio')
    .not('mubi_slug', 'is', null)
    .or('photo_url.is.null,bio.is.null')
    .order('popularity_score', { ascending: false }); // Prioritize popular actors

  if (error) {
    console.error('[DB ERROR] Failed to fetch people to enrich:', error);
    process.exit(1);
  }

  console.log(`[QUEUE] Found ${peopleToEnrich.length} people needing enrichment.`);

  for (let i = 0; i < peopleToEnrich.length; i++) {
    const person = peopleToEnrich[i];
    console.log(`\n[${i + 1}/${peopleToEnrich.length}] Processing ${person.name}...`);
    
    await processPerson(person);
    
    // Polite scraping delay
    await randomDelay(1500, 3500);
  }

  console.log('\n--- ENRICHMENT COMPLETE ---');
}

runEnrichment();
