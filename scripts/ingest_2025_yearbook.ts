import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function ingest2025Data(movies: any[], actorRankings: any[]) {
  console.log('🚀 Ingesting 2025 FilmOne Box Office Yearbook Data into Supabase...');

  // 1. Ingest 2025 Movies
  let movieUpdates = 0;
  for (const m of movies) {
    if (!m.title || !m.box_office_ngn) continue;

    const title = m.title.trim();
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
          domestic: m.box_office_ngn,
          currency: 'NGN',
          source: 'FilmOne Box Office Yearbook (2025)',
          source_url: 'https://online.fliphtml5.com/ogfbg/abpz/',
          updated_at: new Date().toISOString()
        }
      };

      const { error } = await supabase
        .from('films')
        .update({ streaming_links: updatedLinks, updated_at: new Date().toISOString() })
        .eq('id', film.id);

      if (!error) {
        movieUpdates++;
        console.log(`  ✓ Updated 2025 Box Office for film "${film.title}": ₦${m.box_office_ngn.toLocaleString()}`);
      }
    } else {
      console.log(`  ℹ️ Creating film record for 2025 film "${title}"...`);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { error: fErr } = await supabase
        .from('films')
        .insert([{
          title,
          slug,
          year: 2025,
          release_type: 'cinema',
          streaming_links: {
            box_office: {
              domestic: m.box_office_ngn,
              currency: 'NGN',
              source: 'FilmOne Box Office Yearbook (2025)',
              source_url: 'https://online.fliphtml5.com/ogfbg/abpz/',
              updated_at: new Date().toISOString()
            }
          }
        }]);

      if (!fErr) {
        movieUpdates++;
        console.log(`  ✓ Created & updated 2025 film "${title}": ₦${m.box_office_ngn.toLocaleString()}`);
      }
    }
  }

  // 2. Ingest 2025 Actor Rankings
  let actorUpdates = 0;
  for (const r of actorRankings) {
    if (!r.person_name || !r.rank) continue;

    const personName = r.person_name.trim();
    let personId = null;

    const { data: person } = await supabase
      .from('people')
      .select('id, name')
      .ilike('name', personName)
      .maybeSingle();

    if (person) {
      personId = person.id;
    } else {
      console.log(`  ℹ️ Creating person record for "${personName}"...`);
      const slug = personName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data: newP } = await supabase
        .from('people')
        .insert([{ name: personName, slug }])
        .select('id')
        .single();
      
      if (newP) personId = newP.id;
    }

    if (personId) {
      const payload = {
        person_id: personId,
        year: 2025,
        category: r.category || 'Nollywood Overall',
        rank: r.rank,
        gross_label: r.gross_label || `₦${(r.gross_ngn || 0).toLocaleString()}`,
        gross_ngn_estimate: r.gross_ngn || 0,
        films: r.films || [],
        source_name: 'FilmOne Nigerian Box Office Yearbook 2025',
        source_url: 'https://online.fliphtml5.com/ogfbg/abpz/',
        source_page: r.page || 81,
        criteria: r.criteria || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('person_box_office_rankings')
        .upsert(payload, { onConflict: 'person_id,year,category,rank,source_name' });

      if (!error) {
        actorUpdates++;
        console.log(`  ✓ Ingested 2025 Ranking for "${personName}": #${r.rank} in ${r.category} (${payload.gross_label})`);
      } else {
        console.error(`  ❌ Error ranking ${personName}:`, error.message);
      }
    }
  }

  console.log('\n=============================================');
  console.log(`✅ 2025 Yearbook Data Ingestion Finished!`);
  console.log(`• 2025 Movies Ingested/Updated: ${movieUpdates}`);
  console.log(`• 2025 Actor Rankings Ingested: ${actorUpdates}`);
  console.log('=============================================');
}
