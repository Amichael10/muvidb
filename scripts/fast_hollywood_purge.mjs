import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const AFRICAN_KEYWORDS = [
  'nigeria', 'ghana', 'south africa', 'kenya', 'uganda', 'tanzania', 'cameroon',
  'rwanda', 'zimbabwe', 'senegal', 'zambia', 'egypt', 'morocco', 'ethiopia',
  'liberia', 'sierra leone', 'nollywood', 'yoruba', 'igbo', 'hausa', 'kannywood',
  'ghallywood', 'lagos', 'accra', 'ibadan', 'enugu', 'benin city', 'abuja', 'jos'
];

async function parallelDelete(table, column, ids, batchSize = 200, concurrency = 5) {
  let deleted = 0;
  const chunks = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    chunks.push(ids.slice(i, i + batchSize));
  }

  for (let i = 0; i < chunks.length; i += concurrency) {
    const concurrentChunks = chunks.slice(i, i + concurrency);
    const results = await Promise.all(
      concurrentChunks.map(chunk =>
        supabase.from(table).delete({ count: 'exact' }).in(column, chunk)
      )
    );
    for (const r of results) {
      if (!r.error && r.count) deleted += r.count;
    }
  }
  return deleted;
}

async function fastPurge() {
  console.log('🚨 === FAST PARALLEL PURGE OF HOLLYWOOD & FOREIGN MOVIES/PEOPLE ===\n');

  // 1. Find all foreign / TMDB worker films
  console.log('Step 1: Finding all foreign / TMDB worker films...');
  let foreignFilmIds = [];
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
  foreignFilmIds = Array.from(new Set(foreignFilmIds));
  console.log(`Found ${foreignFilmIds.length} foreign films to purge.`);

  if (foreignFilmIds.length > 0) {
    // 2. Fast parallel delete of credits & child tables
    console.log('Step 2: Fast parallel deleting credits & links for foreign films...');
    const delCredits = await parallelDelete('credits', 'film_id', foreignFilmIds, 250, 6);
    console.log(` -> Deleted ${delCredits} credits.`);

    // 3. Fast parallel delete of films
    console.log('Step 3: Fast parallel deleting foreign films...');
    const delFilms = await parallelDelete('films', 'id', foreignFilmIds, 200, 6);
    console.log(` -> Deleted ${delFilms} foreign films.`);
  }

  // 4. Purge foreign/orphan people who have 0 remaining credits in Nollywood films
  console.log('\nStep 4: Finding orphan & Hollywood people...');
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

  const peopleToDelete = [];
  for (const p of allPeople) {
    if (p.claimed_by) continue; // preserve claimed accounts

    const hasCredits = activePersonIds.has(p.id);
    if (!hasCredits) {
      const context = `${p.name} ${p.bio || ''} ${p.birthplace || ''}`.toLowerCase();
      const hasAfricanContext = AFRICAN_KEYWORDS.some(k => context.includes(k));
      if (!hasAfricanContext || p.source === 'tmdb_seed' || p.source === 'tmdb_continuous_worker' || p.source === 'tmdb') {
        peopleToDelete.push(p.id);
      }
    }
  }
  console.log(`Found ${peopleToDelete.length} orphan/foreign people to delete.`);

  // 5. Fast parallel delete of people
  if (peopleToDelete.length > 0) {
    console.log('Step 5: Fast parallel deleting orphan/foreign people...');
    await parallelDelete('person_media', 'person_id', peopleToDelete, 250, 6);
    const delPeople = await parallelDelete('people', 'id', peopleToDelete, 200, 6);
    console.log(` -> Deleted ${delPeople} foreign people.`);
  }

  // 6. Explicit check & delete for Hollywood celebrities
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
    await parallelDelete('credits', 'person_id', hIds, 50, 2);
    await parallelDelete('person_media', 'person_id', hIds, 50, 2);
    await parallelDelete('people', 'id', hIds, 50, 2);
    console.log(`Deleted ${lingeringHollywood.length} explicitly matched Hollywood celebrity records.`);
  }

  // 7. Verify Jumanji or other titles are 100% gone
  const { count: jumanjiCheck } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true })
    .ilike('title', '%jumanji%');

  const { count: finalFilmCount } = await supabase.from('films').select('*', { count: 'exact', head: true });
  const { count: finalPeopleCount } = await supabase.from('people').select('*', { count: 'exact', head: true });
  const { count: finalCreditsCount } = await supabase.from('credits').select('*', { count: 'exact', head: true });

  console.log(`\n======================================================`);
  console.log(`🎉 FAST PURGE COMPLETE!`);
  console.log(`- Jumanji Remaining:  ${jumanjiCheck || 0}`);
  console.log(`- Remaining Films:   ${finalFilmCount}`);
  console.log(`- Remaining People:  ${finalPeopleCount}`);
  console.log(`- Remaining Credits: ${finalCreditsCount}`);
  console.log(`======================================================\n`);
}

fastPurge().catch(console.error);
