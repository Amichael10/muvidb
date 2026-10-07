import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function main() {
  console.log('--- 1. Checking Richard Mofe-Damijo (RMD) Credits & Duplicate Films ---');
  const RMD_ID = '676620ec-5004-41df-944f-e39b3ee62e54';
  const { data: rmdCredits, error: rmdErr } = await supabase
    .from('credits')
    .select('id, role, character_name, billing_order, film_id, films(id, title, year, release_type, source, box_office_domestic)')
    .eq('person_id', RMD_ID);

  if (rmdErr) {
    console.error('RMD fetch error:', rmdErr);
  } else {
    console.log(`RMD has ${rmdCredits.length} total credits.`);
    // Group by film title
    const titleMap: Record<string, any[]> = {};
    for (const c of rmdCredits) {
      const title = (c.films as any)?.title || 'Unknown';
      if (!titleMap[title]) titleMap[title] = [];
      titleMap[title].push(c);
    }
    const dupes = Object.entries(titleMap).filter(([_, list]) => list.length > 1);
    console.log(`RMD has duplicate credits across ${dupes.length} titles:`);
    for (const [title, list] of dupes) {
      console.log(`\n  Title: "${title}" (${list.length} credits):`);
      for (const item of list) {
        const f = item.films as any;
        console.log(`    Credit ${item.id}: role=${item.role}, char="${item.character_name}", filmId=${item.film_id}, year=${f?.year}, relType=${f?.release_type}, source=${f?.source}, bo=${f?.box_office_domestic}`);
      }
    }
  }

  console.log('\n--- 2. Checking Anikulapo Films in DB ---');
  const { data: anikulapoFilms } = await supabase
    .from('films')
    .select('id, title, year, release_type, source, view_count, box_office_domestic, youtube_watch_url')
    .ilike('title', '%anikulapo%');

  console.log(`Found ${anikulapoFilms?.length || 0} films matching "anikulapo":`);
  anikulapoFilms?.forEach(f => {
    console.log(`  ID: ${f.id} | Title: "${f.title}" | Year: ${f.year} | Rel: ${f.release_type} | Source: ${f.source} | Views: ${f.view_count} | BO: ${f.box_office_domestic} | URL: ${f.youtube_watch_url}`);
  });

  console.log('\n--- 3. Checking Yorubahood Channel & Films ---');
  const { data: yorubahoodCh } = await supabase
    .from('channels')
    .select('id, channel_id, name')
    .ilike('name', '%yorubahood%');

  console.log('Yorubahood channels:', yorubahoodCh);

  console.log('\n--- 4. Checking Global Duplicate Film Titles in DB ---');
  // Fetch all films titles & IDs to find duplicates
  let allFilms: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, year, release_type, source, box_office_domestic, view_count')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allFilms = allFilms.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log(`Total films in database: ${allFilms.length}`);

  const normalizeTitle = (t: string) =>
    (t || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');

  const grouped: Record<string, any[]> = {};
  for (const f of allFilms) {
    const norm = normalizeTitle(f.title);
    if (!norm) continue;
    if (!grouped[norm]) grouped[norm] = [];
    grouped[norm].push(f);
  }

  const dupGroups = Object.entries(grouped).filter(([_, list]) => list.length > 1);
  console.log(`Found ${dupGroups.length} title groups with multiple film entries!`);

  // Show top 25 duplicate groups
  dupGroups.slice(0, 25).forEach(([norm, list]) => {
    console.log(`\nGroup "${list[0].title}" (${list.length} entries):`);
    list.forEach(f => {
      console.log(`  id=${f.id} | title="${f.title}" | year=${f.year} | rel=${f.release_type} | src=${f.source} | bo=${f.box_office_domestic} | views=${f.view_count}`);
    });
  });
}

main().catch(console.error);
