import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const plays = JSON.parse(fs.readFileSync('scratch/tnr_extracted_plays.json', 'utf8'));
  console.log(`Ingesting ${plays.length} stage plays from The Nollywood Reporter into 'plays' table...`);

  let created = 0;
  let updated = 0;

  for (const p of plays) {
    const payload = {
      title: p.title,
      slug: p.slug,
      playwright: p.playwright || null,
      director: p.director || null,
      producer: p.producer || null,
      venue: p.venue || null,
      city: p.city || null,
      country: p.country || 'Nigeria',
      poster_url: p.poster_url || null,
      banner_url: p.poster_url || null,
      synopsis: p.synopsis || null,
      genre: p.genre || 'Stage Play',
      year: p.year || 2024,
      run_start_date: p.run_start_date || null,
      run_end_date: p.run_end_date || null,
      status: p.status || 'archived',
      source_url: p.source_url,
      updated_at: new Date().toISOString()
    };

    const { data: existing } = await supabase
      .from('plays')
      .select('id, title')
      .or(`slug.eq.${p.slug},title.eq.${p.title}`)
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('plays').update(payload).eq('id', existing.id);
      if (error) {
        console.error(`❌ Error updating "${p.title}":`, error.message);
      } else {
        console.log(`✅ Updated existing play: "${p.title}"`);
        updated++;
      }
    } else {
      const { error } = await supabase.from('plays').insert([payload]);
      if (error) {
        console.error(`❌ Error inserting "${p.title}":`, error.message);
      } else {
        console.log(`✨ Inserted new stage play: "${p.title}"`);
        created++;
      }
    }
  }

  console.log(`\n🎉 Ingestion complete: ${created} created, ${updated} updated.`);
}

main().catch(console.error);
