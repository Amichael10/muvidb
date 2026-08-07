import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { enrichPersonStrict, applyPersonStrictEnrichment } from '../src/lib/strictPeopleEnricher.server.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runStrictPeopleEnrichment() {
  console.log('🚀 STARTING STRICT ZERO-HALLUCINATION PEOPLE ENRICHMENT SCAN...');

  const { data: people, error } = await supabase
    .from('people')
    .select('id, name, bio, photo_url, date_of_birth, gender, tmdb_id, instagram_url, twitter_url, facebook_url, tiktok_url, youtube_handle')
    .or('bio.is.null,photo_url.is.null,instagram_url.is.null')
    .order('popularity_score', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error querying people:', error);
    process.exit(1);
  }

  console.log(`Found ${people?.length || 0} people requiring verification.`);

  let enrichedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < (people?.length || 0); i++) {
    const person = people![i];
    console.log(`\n[${i + 1}/${people!.length}] Auditing: "${person.name}"...`);

    try {
      const enrichment = await enrichPersonStrict(person);

      if (enrichment.verified) {
        await applyPersonStrictEnrichment(person.id, enrichment.data);
        console.log(`  ✅ GROUNDED MATCH FOUND (${enrichment.sources.join(', ')}):`);
        console.log(`     Enriched fields: ${Object.keys(enrichment.data).join(', ')}`);
        enrichedCount++;
      } else {
        console.log(`  🛑 SKIPPED: No official grounded match found. Leaving fields blank.`);
        skippedCount++;
      }
    } catch (e: any) {
      console.error(`  ❌ Error auditing "${person.name}":`, e.message);
    }
  }

  console.log(`\n🎉 FINISHED! Enriched: ${enrichedCount} | Skipped (Unverified): ${skippedCount}`);
}

runStrictPeopleEnrichment().catch(console.error);
