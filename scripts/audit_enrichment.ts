import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// These TMDB IDs are clearly non-Nigerian films based on the sample
// We'll use language + title pattern + TMDB origin as signals

// Titles that are obviously NOT Nigerian/African films
const CLEARLY_NON_AFRICAN_PATTERNS = [
  /\bjapanese?\b/i, /\bkorean?\b/i, /\bchinese?\b/i, /\banime\b/i,
  /\bkamen rider\b/i, /\bgetto robo\b/i, /\bsararîman\b/i,
  /trinidad\b/i, /\btobago\b/i,
  /neo generations\b/i, /neo tokyo\b/i,
  /neo ned\b/i, /neo-noir\b/i, /neo rauch\b/i,
  /neo impressionist\b/i, /neo-impressionist\b/i,
  /dhamaal\b/i, /bollywood\b/i,
];

async function run() {
  // Fetch all 619 enrichment films
  let allFilms: any[] = [];
  let page = 0;

  while (true) {
    const { data, error } = await sb
      .from('films')
      .select('id, title, year, tmdb_id, countries, language, synopsis, source')
      .eq('source', 'full_catalog_enrichment')
      .range(page * 500, (page + 1) * 500 - 1);

    if (error) { console.error(error.message); break; }
    if (!data?.length) break;
    allFilms = allFilms.concat(data);
    if (data.length < 500) break;
    page++;
  }

  console.log(`Total enrichment films: ${allFilms.length}\n`);

  // Classify by multiple signals
  const toDelete: any[] = [];
  const toKeep: any[] = [];

  for (const f of allFilms) {
    const title = (f.title || '').trim();
    const language = (f.language || '').toLowerCase();
    const synopsis = (f.synopsis || '').toLowerCase();
    const countries: string[] = f.countries || [];

    // Signal 1: Explicitly non-Nigerian countries
    const hasNonAfricanCountry = countries.some(c =>
      !['Nigeria', 'NG', 'Ghana', 'GH', 'Kenya', 'KE', 'South Africa', 'ZA',
        'Ethiopia', 'ET', 'Uganda', 'UG', 'Tanzania', 'TZ', 'Cameroon', 'CM',
        'Ivory Coast', 'CI', '', 'NG'].includes(c)
    );

    // Signal 2: Obviously non-African language
    const isNonAfricanLanguage = ['ja', 'ko', 'zh', 'hi', 'fr', 'es', 'de', 'pt', 'ar', 'ru'].includes(language);

    // Signal 3: Title matches clearly non-African patterns
    const titleIsNonAfrican = CLEARLY_NON_AFRICAN_PATTERNS.some(re => re.test(title));

    // Signal 4: Vaselinetjie, Mr. Bones (South African) — keep those
    // Signal 5: No TMDB + no countries + synopsis mentions Africa/Nigeria — keep
    const synopsisAfricanRef = synopsis.includes('nigeri') ||
      synopsis.includes('africa') || synopsis.includes('nollywood') ||
      synopsis.includes('yoruba') || synopsis.includes('igbo') || synopsis.includes('ghana');

    const noCountryData = countries.length === 0;
    const noTmdb = !f.tmdb_id;

    if (hasNonAfricanCountry || isNonAfricanLanguage || titleIsNonAfrican) {
      toDelete.push(f);
    } else if (noCountryData && noTmdb && !synopsisAfricanRef) {
      // Ambiguous: no country, no TMDB, no African reference in synopsis
      // Flag for review — we'll include in delete list since we can't confirm they're African
      toDelete.push({ ...f, _reason: 'ambiguous_no_data' });
    } else {
      toKeep.push(f);
    }
  }

  const ambiguous = toDelete.filter((f: any) => f._reason === 'ambiguous_no_data');
  const confirmed = toDelete.filter((f: any) => !f._reason);

  console.log('=== CLASSIFICATION RESULTS ===');
  console.log(`Keep (confirmed African/Nigerian)     : ${toKeep.length}`);
  console.log(`Delete — confirmed non-African        : ${confirmed.length}`);
  console.log(`Delete — ambiguous (no data at all)   : ${ambiguous.length}`);
  console.log(`TOTAL to delete                       : ${toDelete.length}`);

  console.log('\n--- Confirmed KEEP sample (10) ---');
  toKeep.slice(0, 10).forEach(f =>
    console.log(`  ${f.title} | countries:${JSON.stringify(f.countries)} | lang:${f.language}`)
  );

  console.log('\n--- Confirmed NON-African (10 sample) ---');
  confirmed.slice(0, 10).forEach(f =>
    console.log(`  ${f.title} | countries:${JSON.stringify(f.countries)} | lang:${f.language}`)
  );

  console.log('\n--- Ambiguous / no data (10 sample) ---');
  ambiguous.slice(0, 10).forEach(f =>
    console.log(`  ${f.title} | tmdb:${f.tmdb_id} | synopsis_snippet:"${f.synopsis?.slice(0,60) || 'none'}"`)
  );

  // Save delete list
  const fs = await import('fs');
  const deleteIds = toDelete.map((f: any) => f.id);
  fs.writeFileSync(
    'scratch/enrichment_delete_ids.json',
    JSON.stringify({ count: deleteIds.length, ids: deleteIds }, null, 2)
  );
  console.log(`\n✅ Saved ${deleteIds.length} IDs to scratch/enrichment_delete_ids.json`);
  console.log('   Run rollback_enrichment.ts to delete them.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
