import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function purgeHollywoodData() {
  console.log('🧹 Starting Hollywood / Non-African Data Cleanup...');

  // 1. Find all films created by tmdb_continuous_worker
  const { data: workerFilms, error: wfErr } = await supabase
    .from('films')
    .select('id, title, release_date, tmdb_id, source')
    .eq('source', 'tmdb_continuous_worker');

  console.log(`Found ${workerFilms?.length || 0} films created with source = tmdb_continuous_worker`);

  // Also search for obvious Hollywood franchises (Star Trek, Marvel, Batman, Disney, etc.)
  const { data: franchiseFilms } = await supabase
    .from('films')
    .select('id, title, source')
    .or('title.ilike.%Star Trek%,title.ilike.%Futurama%,title.ilike.%Space Jam%,title.ilike.%Pinky and the Brain%,title.ilike.%Zootopia%');

  const filmIdsToDelete = new Set();
  (workerFilms || []).forEach(f => filmIdsToDelete.add(f.id));
  (franchiseFilms || []).forEach(f => filmIdsToDelete.add(f.id));

  console.log(`Total foreign films identified for removal: ${filmIdsToDelete.size}`);

  if (filmIdsToDelete.size > 0) {
    const idsArray = Array.from(filmIdsToDelete);
    
    // Chunk deletion in batches of 50
    for (let i = 0; i < idsArray.length; i += 50) {
      const chunk = idsArray.slice(i, i + 50);
      // Delete associated credits first
      const { error: cErr } = await supabase.from('credits').delete().in('film_id', chunk);
      if (cErr) console.warn('Credit delete warning:', cErr.message);

      // Delete films
      const { error: fErr } = await supabase.from('films').delete().in('id', chunk);
      if (fErr) console.error('Film delete error:', fErr.message);
      else console.log(`  🗑️ Deleted batch ${i + 1} - ${Math.min(i + 50, idsArray.length)} foreign films.`);
    }
  }

  // 2. Identify and inspect foreign / Hollywood actors in people table
  console.log('\n🔍 Scanning people table for non-African / foreign actors...');
  
  // Find people who only have credits in foreign movies or have foreign birthplace / non-African origins
  const { data: allPeople, error: pErr } = await supabase
    .from('people')
    .select('id, name, nationality, birthplace, bio, tmdb_id, film_count, source')
    .limit(1000);

  const foreignPeopleIds = [];

  for (const p of allPeople || []) {
    const nameLower = (p.name || '').toLowerCase();
    const bioLower = (p.bio || '').toLowerCase();
    const birthplaceLower = (p.birthplace || '').toLowerCase();

    // Check if obvious Hollywood / American actors seeded in early days
    const isObviousForeign = 
      birthplaceLower.includes('united states') ||
      birthplaceLower.includes('california') ||
      birthplaceLower.includes('new york') ||
      birthplaceLower.includes('los angeles') ||
      birthplaceLower.includes('texas') ||
      birthplaceLower.includes('england') ||
      birthplaceLower.includes('london') ||
      p.nationality === 'American' ||
      p.nationality === 'British' ||
      p.nationality === 'Canadian';

    // Verify if they have ZERO African film credits
    if (isObviousForeign) {
      const { data: actorCredits } = await supabase
        .from('credits')
        .select('id, films(title, release_type, source)')
        .eq('person_id', p.id);

      const hasAfricanCredit = (actorCredits || []).some(c => 
        c.films?.release_type === 'cinema' || 
        c.films?.release_type === 'youtube' ||
        c.films?.source?.includes('nolli')
      );

      if (!hasAfricanCredit) {
        foreignPeopleIds.push({ id: p.id, name: p.name, reason: p.nationality || p.birthplace });
      }
    }
  }

  console.log(`Found ${foreignPeopleIds.length} foreign / Hollywood actors with no African credits:`);
  foreignPeopleIds.forEach(p => console.log(`- ${p.name} (${p.reason})`));

  if (foreignPeopleIds.length > 0) {
    const pIds = foreignPeopleIds.map(p => p.id);
    for (let i = 0; i < pIds.length; i += 50) {
      const chunk = pIds.slice(i, i + 50);
      await supabase.from('credits').delete().in('person_id', chunk);
      await supabase.from('people').delete().in('id', chunk);
      console.log(`  🗑️ Deleted batch of ${chunk.length} foreign actors.`);
    }
  }

  console.log('\n✨ Purge complete!');
}

purgeHollywoodData().catch(console.error);
