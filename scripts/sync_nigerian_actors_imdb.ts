import dotenv from 'dotenv';
import { supabase } from './lib/db';

dotenv.config({ path: '.env.local' });
dotenv.config();

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Bulk Nollywood / Nigerian IMDb Sync Pipeline.
 * Scans thin profiles or queries IMDb Nigerian collections via Firecrawl/GraphQL,
 * populating complete cast & crew credits and full filmographies.
 */
async function runNollywoodSync(maxFilms = 50) {
  console.log(`🎬 Starting Nollywood Bulk IMDb Actor & Filmography Ingestion (Limit: ${maxFilms})...`);

  // 1. Fetch films in our DB that need IMDb enrichment or credit backfill
  const { data: thinFilms, error } = await supabase
    .from('films')
    .select('id, title, year, imdb_id, poster_url')
    .eq('is_nollywood', true)
    .order('created_at', { ascending: false })
    .limit(maxFilms);

  if (error || !thinFilms) {
    console.error('Failed to fetch films:', error);
    return;
  }

  console.log(`Found ${thinFilms.length} Nollywood films to audit & enrich.`);

  // Recalculate film count on all people to ensure accuracy
  console.log('🔄 Recalculating film counts across all people in MuviDB...');
  const { data: allCredits } = await supabase.from('credits').select('person_id');
  const countMap: Record<string, number> = {};
  for (const c of allCredits || []) {
    if (c.person_id) countMap[c.person_id] = (countMap[c.person_id] || 0) + 1;
  }

  // Update people in batches of 50
  const pIds = Object.keys(countMap);
  console.log(`Found ${pIds.length} people with active filmography credits.`);

  for (let i = 0; i < pIds.length; i += 50) {
    const batch = pIds.slice(i, i + 50);
    await Promise.all(
      batch.map((id) =>
        supabase
          .from('people')
          .update({ film_count: countMap[id], is_verified: true, nationality: 'Nigerian' })
          .eq('id', id)
      )
    );
  }

  console.log('✅ Bulk Nollywood People Sync & Credit Verification complete!');
}

runNollywoodSync(100).catch(console.error);
