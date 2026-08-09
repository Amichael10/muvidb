import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function ingestYearbooks() {
  console.log('🚀 Ingesting FilmOne Box Office Yearbooks (2019-2024)...');

  // Load 2019-2023 workbook_data.json
  const wbPath = path.join(process.cwd(), 'outputs', 'boxoffice_yearbooks_2019_2023', 'workbook_data.json');
  if (!fs.existsSync(wbPath)) {
    console.error('Missing workbook_data.json at:', wbPath);
    return;
  }

  const data = JSON.parse(fs.readFileSync(wbPath, 'utf8'));

  // 1. Process Movie Box Office Figures
  console.log('\n--- 1. Processing Movie Box Office Grosses ---');
  let movieUpdates = 0;
  for (const item of data.movies || []) {
    if (!item.title || !item.gross_ngn) continue;

    const title = item.title.trim();
    const { data: film } = await supabase
      .from('films')
      .select('id, title, streaming_links')
      .ilike('title', title)
      .maybeSingle();

    if (film) {
      const currentLinks = film.streaming_links || {};
      const updatedLinks = {
        ...currentLinks,
        box_office: {
          domestic: item.gross_ngn,
          currency: 'NGN',
          source: `FilmOne Box Office Yearbook (${item.year})`,
          source_url: item.source_url || null,
          updated_at: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('films')
        .update({ streaming_links: updatedLinks, updated_at: new Date().toISOString() })
        .eq('id', film.id);

      if (!error) {
        movieUpdates++;
        console.log(`  ✓ Updated box office for film "${film.title}": ₦${item.gross_ngn.toLocaleString()}`);
      }
    }
  }

  // 2. Process Actor Rankings
  console.log('\n--- 2. Processing Actor Box Office Rankings ---');
  let actorRankingRows = 0;
  for (const rankItem of data.actors || []) {
    if (!rankItem.name) continue;

    const personName = rankItem.name.trim();

    // Match person in database
    const { data: person } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', personName)
      .maybeSingle();

    if (person) {
      const payload = {
        person_id: person.id,
        year: rankItem.year || 2023,
        category: rankItem.category || rankItem.section || 'Nollywood Overall',
        rank: rankItem.rank,
        gross_label: rankItem.gross_label || `₦${(rankItem.gross_ngn || 0).toLocaleString()}`,
        gross_ngn_estimate: rankItem.gross_ngn || 0,
        films: rankItem.films ? (Array.isArray(rankItem.films) ? rankItem.films : [rankItem.films]) : [],
        source_name: 'FilmOne Nigerian Box Office Yearbook',
        source_url: rankItem.source_url || null,
        source_page: rankItem.page || null,
        criteria: rankItem.criteria || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('person_box_office_rankings')
        .upsert(payload, { onConflict: 'person_id,year,category,rank,source_name' });

      if (!error) {
        actorRankingRows++;
        console.log(`  ✓ Ranked actor "${person.name}": #${rankItem.rank} in ${rankItem.year} (${rankItem.gross_label})`);
      } else {
        console.error(`  ❌ Error ranking ${person.name}:`, error.message);
      }
    }
  }

  console.log('\n=============================================');
  console.log(`✅ Yearbook Ingestion Finished!`);
  console.log(`• Movie Box Office Updated: ${movieUpdates}`);
  console.log(`• Actor Rankings Created/Updated: ${actorRankingRows}`);
  console.log('=============================================');
}

ingestYearbooks();
