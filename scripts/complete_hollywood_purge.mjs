import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// List of African countries / keywords that indicate authentic African origin
const AFRICAN_KEYWORDS = [
  'nigeria', 'ghana', 'south africa', 'kenya', 'uganda', 'tanzania', 'cameroon',
  'rwanda', 'zimbabwe', 'senegal', 'zambia', 'egypt', 'morocco', 'ethiopia',
  'liberia', 'sierra leone', 'nollywood', 'yoruba', 'igbo', 'hausa', 'kannywood',
  'ghallywood', 'lagos', 'accra', 'ibadan', 'enugu', 'benin city', 'abuja', 'jos'
];

async function purgeHollywoodAndForeign() {
  console.log('🚨 === COMPLETE PURGE OF HOLLYWOOD & FOREIGN FILMS/PEOPLE ===\n');

  // 1. Fetch all films with source = 'tmdb_continuous_worker' OR is_nollywood = false
  console.log('Step 1: Finding all foreign / TMDB worker films...');
  let foreignFilmIds = [];
  
  // A. Fetch tmdb_continuous_worker films
  let from = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('films')
      .select('id, title, source, is_nollywood')
      .or('source.eq.tmdb_continuous_worker,is_nollywood.eq.false')
      .range(from, from + PAGE_SIZE - 1);
    
    if (error || !data?.length) break;
    foreignFilmIds.push(...data.map(f => f.id));
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  // Deduplicate
  foreignFilmIds = Array.from(new Set(foreignFilmIds));
  console.log(`Found ${foreignFilmIds.length} foreign films to purge (e.g. Jumanji, European/Hollywood titles).`);

  // 2. Delete credits associated with these foreign films
  console.log('\nStep 2: Deleting credits for foreign films...');
  let deletedCredits = 0;
  for (let i = 0; i < foreignFilmIds.length; i += 100) {
    const chunk = foreignFilmIds.slice(i, i + 100);
    const { count, error } = await supabase
      .from('credits')
      .delete({ count: 'exact' })
      .in('film_id', chunk);
    if (!error && count) deletedCredits += count;
  }
  console.log(` -> Deleted ${deletedCredits} credits linked to foreign films.`);

  // 3. Delete the foreign films themselves
  console.log('\nStep 3: Deleting the foreign films...');
  let deletedFilms = 0;
  for (let i = 0; i < foreignFilmIds.length; i += 100) {
    const chunk = foreignFilmIds.slice(i, i + 100);
    const { count, error } = await supabase
      .from('films')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (!error && count) deletedFilms += count;
  }
  console.log(` -> Deleted ${deletedFilms} foreign film records.`);

  // 4. Purge orphan or Hollywood people who have 0 remaining credits in Nollywood films
  console.log('\nStep 4: Finding orphan & Hollywood people with 0 Nollywood credits...');
  
  // Load all people with their credits
  let allPeople = [];
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, nationality, birthplace, bio, claimed_by, source')
      .range(from, from + PAGE_SIZE - 1);
    
    if (error || !data?.length) break;
    allPeople.push(...data);
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`Total people in DB: ${allPeople.length}`);

  // Fetch all active person_ids in credits
  let activePersonIds = new Set();
  from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('credits')
      .select('person_id')
      .range(from, from + PAGE_SIZE - 1);
    
    if (error || !data?.length) break;
    data.forEach(c => activePersonIds.add(c.person_id));
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }
  console.log(`Total people with active film credits: ${activePersonIds.size}`);

  // Identify people to delete:
  // - Have 0 active credits AND are not claimed AND are not in Nollywood source/bio
  const peopleToDelete = [];
  for (const p of allPeople) {
    // Keep claimed actor profiles (e.g. End To End Test or real users)
    if (p.claimed_by) continue;

    const hasCredits = activePersonIds.has(p.id);
    if (!hasCredits) {
      // Check if bio or birthplace has African context
      const context = `${p.name} ${p.bio || ''} ${p.birthplace || ''}`.toLowerCase();
      const hasAfricanContext = AFRICAN_KEYWORDS.some(k => context.includes(k));
      
      // If no credits and manual/tmdb source without African context -> delete
      if (!hasAfricanContext || p.source === 'tmdb_seed' || p.source === 'tmdb_continuous_worker' || p.source === 'tmdb') {
        peopleToDelete.push(p.id);
      }
    }
  }

  console.log(`Found ${peopleToDelete.length} orphan/foreign people to delete.`);

  // 5. Delete people in chunks
  let deletedPeople = 0;
  for (let i = 0; i < peopleToDelete.length; i += 100) {
    const chunk = peopleToDelete.slice(i, i + 100);
    // Delete any person_media or remaining links
    await supabase.from('person_media').delete().in('person_id', chunk);
    const { count, error } = await supabase
      .from('people')
      .delete({ count: 'exact' })
      .in('id', chunk);
    if (!error && count) deletedPeople += count;
  }
  console.log(` -> Deleted ${deletedPeople} foreign / orphan people.`);

  // 6. Fix any people with faulty 'Nigerian' nationality who are known Hollywood actors
  const KNOWN_HOLLYWOOD_NAMES = [
    'Jack Black', 'Kevin Hart', 'Dwayne Johnson', 'Tom Cruise', 'Brad Pitt',
    'Leonardo DiCaprio', 'Zendaya', 'Karen Gillan', 'Robin Williams', 'Will Smith',
    'Chris Hemsworth', 'Robert Downey Jr', 'Scarlett Johansson', 'Chris Evans',
    'Mark Ruffalo', 'Tom Holland', 'Benedict Cumberbatch', 'Ryan Reynolds',
    'Samuel L. Jackson', 'Morgan Freeman', 'Denzel Washington', 'Vin Diesel',
    'Jason Statham', 'Sylvester Stallone', 'Arnold Schwarzenegger'
  ];

  const { data: lingeringHollywood } = await supabase
    .from('people')
    .select('id, name')
    .in('name', KNOWN_HOLLYWOOD_NAMES);

  if (lingeringHollywood && lingeringHollywood.length > 0) {
    const hIds = lingeringHollywood.map(h => h.id);
    await supabase.from('credits').delete().in('person_id', hIds);
    await supabase.from('person_media').delete().in('person_id', hIds);
    await supabase.from('people').delete().in('id', hIds);
    console.log(`Deleted ${lingeringHollywood.length} explicitly matched Hollywood celebrity records.`);
  }

  // 7. Verify clean DB counts
  const { count: finalFilmCount } = await supabase.from('films').select('*', { count: 'exact', head: true });
  const { count: finalPeopleCount } = await supabase.from('people').select('*', { count: 'exact', head: true });
  const { count: finalCreditsCount } = await supabase.from('credits').select('*', { count: 'exact', head: true });

  console.log(`\n======================================================`);
  console.log(`🎉 PURGE COMPLETE! Clean Pure Nollywood Database Status:`);
  console.log(`- Remaining Films:   ${finalFilmCount}`);
  console.log(`- Remaining People:  ${finalPeopleCount}`);
  console.log(`- Remaining Credits: ${finalCreditsCount}`);
  console.log(`======================================================\n`);
}

purgeHollywoodAndForeign().catch(console.error);
