import './dotenv_init.js';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function matchPerson(rawName: string): Promise<{ id: string; name: string } | null> {
  const clean = rawName.trim();
  if (!clean) return null;

  try {
    const { data: foundId } = await supabase.rpc('find_person_by_name', { p_name: clean });
    if (foundId) {
      const { data: p } = await supabase.from('people').select('id, name').eq('id', foundId).single();
      if (p) return p;
    }
  } catch {}

  const { data: exact } = await supabase.from('people').select('id, name').ilike('name', clean).limit(1);
  if (exact && exact.length > 0) return exact[0];

  return null;
}

async function matchFilm(rawTitle: string): Promise<{ id: string; title: string } | null> {
  const clean = rawTitle.trim();
  if (!clean) return null;

  // 1. Exact match on full raw title
  const { data: exact } = await supabase.from('films').select('id, title').ilike('title', clean).limit(1);
  if (exact && exact.length > 0) return exact[0];

  // 2. Exact match without parentheses
  const withoutParens = clean.replace(/\s*\(.*?\)\s*/g, ' ').trim();
  if (withoutParens && withoutParens !== clean) {
    const { data: exactNoParens } = await supabase.from('films').select('id, title').ilike('title', withoutParens).limit(1);
    if (exactNoParens && exactNoParens.length > 0) return exactNoParens[0];
  }

  // 3. Strict fuzzy match
  const { data: fuzzy } = await supabase.rpc('match_film_fuzzy', { query_title: clean, threshold: 0.88 }).maybeSingle();
  if (fuzzy?.id) {
    const { data: f } = await supabase.from('films').select('id, title').eq('id', fuzzy.id).single();
    if (f && Math.abs(f.title.length - clean.length) <= 8) return f;
  }

  return null;
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const jsonPath = path.join(process.cwd(), 'data', 'aiff_2026_nominees.json');

  if (!fs.existsSync(jsonPath)) {
    console.error('❌ Missing data file:', jsonPath);
    process.exit(1);
  }

  const dataset = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  console.log(`🎬 Syncing ${dataset.festival.name} (${dataset.festival.edition} - ${dataset.festival.year}) Nominations...`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN' : 'APPLY TO DATABASE'}\n`);

  let filmsEnriched = 0;
  let peopleEnriched = 0;

  for (const group of dataset.categories) {
    console.log(`\n🏆 Category: "${group.category}" (${group.nominees.length} nominees)`);

    for (const nom of group.nominees) {
      const filmTitle = nom.film || nom.title;
      const personName = nom.person || nom.director || nom.nominee;

      let filmRecord = null;
      if (filmTitle) {
        filmRecord = await matchFilm(filmTitle);
      }

      let personRecord = null;
      if (personName && !personName.includes(',')) {
        personRecord = await matchPerson(personName);
      }

      console.log(`   • ${personName ? `${personName} ` : ''}${filmTitle ? `("${filmTitle}")` : ''}`);
      if (filmRecord) console.log(`     ✓ Matched Film: "${filmRecord.title}" [${filmRecord.id}]`);
      if (personRecord) console.log(`     ✓ Matched Person: "${personRecord.name}" [${personRecord.id}]`);

      if (!dryRun) {
        // 1. Enrich Film Awards
        if (filmRecord) {
          const { data: fData } = await supabase.from('films').select('awards').eq('id', filmRecord.id).single();
          const currentAwards = Array.isArray(fData?.awards) ? [...fData.awards] : [];

          const exists = currentAwards.some((a: any) =>
            String(a.organization || '').toUpperCase() === 'AIFF' &&
            Number(a.year) === 2026 &&
            String(a.category || '').toLowerCase() === group.category.toLowerCase()
          );

          if (!exists) {
            currentAwards.push({
              organization: 'AIFF',
              edition: '23rd Edition',
              year: 2026,
              category: group.category,
              nominee: personName || null,
              won: false
            });

            await supabase.from('films').update({ awards: currentAwards }).eq('id', filmRecord.id);
            filmsEnriched++;
          }
        }

        // 2. Enrich Person Awards
        if (personRecord) {
          const { data: pData } = await supabase.from('people').select('awards').eq('id', personRecord.id).single();
          const currentAwards = Array.isArray(pData?.awards) ? [...pData.awards] : [];

          const exists = currentAwards.some((a: any) =>
            String(a.organization || '').toUpperCase() === 'AIFF' &&
            Number(a.year) === 2026 &&
            String(a.category || '').toLowerCase() === group.category.toLowerCase()
          );

          if (!exists) {
            currentAwards.push({
              organization: 'AIFF',
              edition: '23rd Edition',
              year: 2026,
              category: group.category,
              work: filmTitle || null,
              film_id: filmRecord?.id || null,
              won: false
            });

            await supabase.from('people').update({ awards: currentAwards }).eq('id', personRecord.id);
            peopleEnriched++;
          }
        }
      }
    }
  }

  console.log('\n============================================================');
  console.log(`🎉 AIFF 2026 Nominations Synchronization Complete!`);
  console.log(`   Films Enriched: ${filmsEnriched}`);
  console.log(`   People Enriched: ${peopleEnriched}`);
  console.log('============================================================');
}

run().catch(console.error);
