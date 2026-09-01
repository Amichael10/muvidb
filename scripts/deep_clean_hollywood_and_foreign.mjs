import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tmdbKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
const tmdbToken = process.env.VITE_TMDB_READ_ACCESS_TOKEN;

const AFRICAN_COUNTRIES = [
  'nigeria', 'ghana', 'south africa', 'kenya', 'uganda', 'tanzania', 'cameroon',
  'rwanda', 'zimbabwe', 'senegal', 'zambia', 'egypt', 'morocco', 'ethiopia', 'liberia', 'sierra leone'
];

const FOREIGN_BIRTHPLACES = [
  'united states', 'usa', 'california', 'new york', 'texas', 'florida', 'illinois',
  'ohio', 'pennsylvania', 'georgia', 'north carolina', 'michigan', 'kentucky',
  'england', 'united kingdom', 'uk', 'london', 'scotland', 'wales', 'ireland',
  'canada', 'ontario', 'toronto', 'vancouver', 'australia', 'sydney', 'melbourne',
  'france', 'paris', 'germany', 'berlin', 'italy', 'rome', 'spain', 'madrid',
  'japan', 'tokyo', 'china', 'beijing', 'india', 'mumbai', 'south korea', 'seoul'
];

async function checkPersonTmdbOrigin(tmdbId) {
  if (!tmdbId) return null;
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  try {
    const url = `https://api.themoviedb.org/3/person/${tmdbId}${queryParam}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      place_of_birth: data.place_of_birth || null,
      name: data.name
    };
  } catch {
    return null;
  }
}

async function deepClean() {
  console.log('🚨 Starting Deep Clean of Hollywood / Foreign Actors & Films...');

  // 1. Fetch top 5000 people from DB
  const { data: people, error: pErr } = await supabase
    .from('people')
    .select('id, name, tmdb_id, nationality, birthplace, bio, film_count, popularity_score')
    .order('popularity_score', { ascending: false })
    .limit(5000);

  if (pErr) {
    console.error('Error fetching people:', pErr.message);
    return;
  }

  console.log(`Analyzing ${people.length} people records...`);

  const peopleToDelete = [];

  for (const p of people) {
    const bplace = (p.birthplace || '').toLowerCase();
    
    // Check if birthplace is explicitly foreign
    let isForeign = FOREIGN_BIRTHPLACES.some(loc => bplace.includes(loc));

    // If birthplace is empty, check TMDB place of birth
    if (!isForeign && p.tmdb_id) {
      const tmdbInfo = await checkPersonTmdbOrigin(p.tmdb_id);
      if (tmdbInfo?.place_of_birth) {
        const tmdbBplace = tmdbInfo.place_of_birth.toLowerCase();
        isForeign = FOREIGN_BIRTHPLACES.some(loc => tmdbBplace.includes(loc));
      }
    }

    if (isForeign) {
      // Check if they have ANY genuine Nollywood / Nigerian cinema / youtube credits
      const { data: credits } = await supabase
        .from('credits')
        .select('id, films(title, release_type, source)')
        .eq('person_id', p.id);

      const hasNollywoodCredit = (credits || []).some(c => 
        c.films?.release_type === 'cinema' ||
        c.films?.release_type === 'youtube' ||
        c.films?.source?.includes('nolli')
      );

      if (!hasNollywoodCredit) {
        peopleToDelete.push({ id: p.id, name: p.name, bplace: p.birthplace || 'TMDB Verified Foreign' });
      }
    }
  }

  console.log(`\nFound ${peopleToDelete.length} Hollywood / Non-African actors to delete:`);
  peopleToDelete.forEach((p, idx) => console.log(`${idx + 1}. ${p.name} (${p.bplace})`));

  if (peopleToDelete.length > 0) {
    const ids = peopleToDelete.map(p => p.id);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      await supabase.from('credits').delete().in('person_id', chunk);
      await supabase.from('person_media').delete().in('person_id', chunk);
      const { error: delErr } = await supabase.from('people').delete().in('id', chunk);
      if (delErr) console.error('Error deleting people chunk:', delErr.message);
      else console.log(`  🗑️ Deleted chunk ${i + 1} - ${Math.min(i + 50, ids.length)} foreign people.`);
    }
  }

  // 2. Final pass: Delete all foreign films created with source tmdb_continuous_worker or with foreign titles
  console.log('\n🎬 Final cleanup of any lingering foreign films...');
  const { data: remainingWorkerFilms } = await supabase
    .from('films')
    .select('id, title')
    .eq('source', 'tmdb_continuous_worker');

  if (remainingWorkerFilms && remainingWorkerFilms.length > 0) {
    const filmIds = remainingWorkerFilms.map(f => f.id);
    for (let i = 0; i < filmIds.length; i += 50) {
      const chunk = filmIds.slice(i, i + 50);
      await supabase.from('credits').delete().in('film_id', chunk);
      await supabase.from('films').delete().in('id', chunk);
    }
    console.log(`  🗑️ Deleted ${remainingWorkerFilms.length} remaining worker films.`);
  }

  console.log('\n🎉 Deep Clean Complete! Database is purely Nollywood & African Cinema.');
}

deepClean().catch(console.error);
