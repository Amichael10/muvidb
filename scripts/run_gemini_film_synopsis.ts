import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { enrichFilmWithGemini, applyFilmEnrichmentToDb } from '../src/lib/filmGeminiEnricher.server.js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runFilmEnrichment() {
  console.log('🚀 STARTING YOUTUBE GEMINI FILM SYNOPSIS, GENRE & AGE RATING ENRICHER...');

  const { data: films, error } = await supabase
    .from('films')
    .select('id, title, year, synopsis, genres, maturity_rating, youtube_watch_url, trailer_youtube_id, source_video_id')
    .or('synopsis.is.null,synopsis.eq.,genres.is.null,maturity_rating.is.null')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error querying films:', error);
    process.exit(1);
  }

  console.log(`Found ${films?.length || 0} films requiring synopsis/genre/age rating enrichment.`);

  let enrichedCount = 0;

  for (let i = 0; i < (films?.length || 0); i++) {
    const film = films![i];
    console.log(`\n[${i + 1}/${films!.length}] Processing: "${film.title}" (${film.year || 'N/A'})...`);

    try {
      const enrichment = await enrichFilmWithGemini(film);

      if (enrichment.synopsis) {
        await applyFilmEnrichmentToDb(film.id, enrichment);
        console.log(`  ✅ ENRICHED:`);
        console.log(`     Synopsis: ${enrichment.synopsis.slice(0, 100)}...`);
        console.log(`     Genre: ${enrichment.genre}`);
        console.log(`     Age Rating: ${enrichment.age_rating}`);
        enrichedCount++;
      } else {
        console.log(`  ⚠️ Skipped: Could not generate clean synopsis.`);
      }
    } catch (e: any) {
      console.error(`  ❌ Error processing "${film.title}":`, e.message);
    }
  }

  console.log(`\n🎉 FINISHED! Successfully enriched ${enrichedCount} films.`);
}

runFilmEnrichment().catch(console.error);
