import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function ingest2024Actors() {
  console.log('🚀 Ingesting 2024 Actor Box Office Rankings from Yearbook...');

  const ndjsonPath = path.join(
    process.cwd(),
    'outputs',
    'boxoffice_yearbook_2024',
    'filmone_boxoffice_yearbook_2024_extract_with_actors.xlsx.inspect.ndjson'
  );

  if (!fs.existsSync(ndjsonPath)) {
    console.error('File not found:', ndjsonPath);
    return;
  }

  const lines = fs.readFileSync(ndjsonPath, 'utf8').split('\n').filter(Boolean);
  let actorCount = 0;

  for (const line of lines) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.sheet === 'Actors 2024' && parsed.kind === 'table' && Array.isArray(parsed.values)) {
        const rows = parsed.values.slice(1); // skip header row

        for (const row of rows) {
          const [category, rankStr, personName, filmTitlesStr, grossLabel, grossNumStr, pageStr, sourceUrl, criteria] = row;
          if (!personName || !rankStr) continue;

          const rank = parseInt(rankStr, 10);
          const grossNum = parseFloat(grossNumStr) || 0;
          const filmsList = (filmTitlesStr || '').split(';').map((f: string) => f.trim()).filter(Boolean);

          // Find person in Supabase
          const { data: person } = await supabase
            .from('people')
            .select('id, name')
            .ilike('name', personName.trim())
            .maybeSingle();

          if (person) {
            const categoryFormatted = category
              .replace(/_/g, ' ')
              .replace(/\b\w/g, (c: string) => c.toUpperCase());

            const payload = {
              person_id: person.id,
              year: 2024,
              category: categoryFormatted,
              rank,
              gross_label: grossLabel || `₦${grossNum.toLocaleString()}`,
              gross_ngn_estimate: grossNum,
              films: filmsList,
              source_name: 'FilmOne Nigerian Box Office Yearbook 2024',
              source_url: sourceUrl || 'https://online.fliphtml5.com/ogfbg/sxhk/',
              source_page: parseInt(pageStr, 10) || 81,
              criteria: criteria || null,
              updated_at: new Date().toISOString()
            };

            const { error } = await supabase
              .from('person_box_office_rankings')
              .upsert(payload, { onConflict: 'person_id,year,category,rank,source_name' });

            if (!error) {
              actorCount++;
              console.log(`  ✓ Ranked "${person.name}": #${rank} in ${categoryFormatted} (${grossLabel})`);
            } else {
              console.error(`  ❌ Error ranking ${person.name}:`, error.message);
            }
          } else {
            console.log(`  ⚠️ Person "${personName}" not found in DB, creating stub...`);
            const slug = personName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
            const { data: newPerson, error: pErr } = await supabase
              .from('people')
              .insert([{ name: personName.trim(), slug }])
              .select('id, name')
              .single();

            if (newPerson) {
              const categoryFormatted = category
                .replace(/_/g, ' ')
                .replace(/\b\w/g, (c: string) => c.toUpperCase());

              const payload = {
                person_id: newPerson.id,
                year: 2024,
                category: categoryFormatted,
                rank,
                gross_label: grossLabel || `₦${grossNum.toLocaleString()}`,
                gross_ngn_estimate: grossNum,
                films: filmsList,
                source_name: 'FilmOne Nigerian Box Office Yearbook 2024',
                source_url: sourceUrl || 'https://online.fliphtml5.com/ogfbg/sxhk/',
                source_page: parseInt(pageStr, 10) || 81,
                criteria: criteria || null,
                updated_at: new Date().toISOString()
              };

              await supabase.from('person_box_office_rankings').upsert(payload, { onConflict: 'person_id,year,category,rank,source_name' });
              actorCount++;
              console.log(`  ✓ Created & Ranked "${newPerson.name}": #${rank} in ${categoryFormatted} (${grossLabel})`);
            }
          }
        }
      }
    } catch (e) {
      // skip invalid lines
    }
  }

  console.log(`\n✅ Finished 2024 Actor Box Office Rankings Ingestion! (${actorCount} actors ranked)`);
}

ingest2024Actors();
