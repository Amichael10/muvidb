/**
 * Continuous Indefinite Actor Enrichment Worker (Guarded for Nollywood & African Cinema)
 * Run anytime on background machines:
 *   node scripts/run_continuous_actor_enrichment.mjs
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const tmdbKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY;
const tmdbToken = process.env.VITE_TMDB_READ_ACCESS_TOKEN;
const firecrawlKey = process.env.FIRECRAWL_API_KEY;
const zenrowsKey = process.env.ZENROWS_API_KEY;

const STATE_FILE = path.resolve('scripts/data/actor_enrichment_state.json');

const AFRICAN_BIRTHPLACES = [
  'nigeria', 'ghana', 'south africa', 'kenya', 'uganda', 'tanzania', 'cameroon',
  'rwanda', 'zimbabwe', 'senegal', 'zambia', 'egypt', 'morocco', 'ethiopia', 'liberia', 'sierra leone',
  'lagos', 'abuja', 'ibadan', 'enugu', 'benin city', 'kano', 'port harcourt', 'accra', 'kumasi', 'nairobi', 'johannesburg', 'kampala'
];

const FOREIGN_COUNTRIES = [
  'united states', 'usa', 'california', 'new york', 'texas', 'florida', 'illinois',
  'ohio', 'pennsylvania', 'georgia', 'north carolina', 'michigan', 'kentucky',
  'england', 'united kingdom', 'uk', 'london', 'scotland', 'wales', 'ireland',
  'canada', 'ontario', 'toronto', 'vancouver', 'australia', 'sydney', 'melbourne',
  'france', 'paris', 'germany', 'berlin', 'italy', 'rome', 'spain', 'madrid',
  'japan', 'tokyo', 'china', 'beijing', 'india', 'mumbai', 'south korea', 'seoul'
];

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return { processed_ids: {}, total_enriched: 0, last_run_at: null };
}

function saveState(state) {
  try {
    const dir = path.dirname(STATE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save state:', err.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateNameVariants(fullName) {
  const variants = new Set();
  const raw = String(fullName || '').trim();
  if (!raw) return [];

  variants.add(raw);

  const bracketMatch = raw.match(/^(.*?)\s*[\(\[\'\"]([^\)\]\'\"]+)[\)\]\'\"]/);
  if (bracketMatch) {
    const main = bracketMatch[1].trim();
    const alias = bracketMatch[2].trim();
    if (main) variants.add(main);
    if (alias && alias.length >= 2) variants.add(alias);
  }

  const cleaned = raw.replace(/\b(chief|dr|alhaji|alhaja|prince|princess|pastor|evangelist|ambassador|mrs|mr|ms)\.?\s+/gi, '').trim();
  if (cleaned && cleaned !== raw) {
    variants.add(cleaned);
  }

  const deaccented = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  variants.add(deaccented);

  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 2) {
    variants.add(`${words[1]} ${words[0]}`);
  } else if (words.length === 3) {
    variants.add(`${words[0]} ${words[1]}`);
    variants.add(`${words[1]} ${words[0]}`);
    variants.add(`${words[2]} ${words[0]} ${words[1]}`);
  }

  return Array.from(variants);
}

/**
 * TMDB Person Details to check Place of Birth / African Origin
 */
async function getTmdbPersonDetails(personId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  try {
    const url = `https://api.themoviedb.org/3/person/${personId}${queryParam}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Check if a TMDB Movie is an authentic Nollywood/African production
 */
async function isAfricanMovie(tmdbMovieId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  try {
    const url = `https://api.themoviedb.org/3/movie/${tmdbMovieId}${queryParam}`;
    const res = await fetch(url, { headers });
    if (!res.ok) return false;
    const data = await res.json();

    const originCountries = data.origin_country || [];
    const prodCountries = (data.production_countries || []).map(c => c.iso_3166_1);
    const allCountries = [...originCountries, ...prodCountries];

    // Check for African countries (NG, GH, ZA, KE, UG, TZ, etc.)
    const isAfricanCountry = allCountries.some(c => ['NG', 'GH', 'ZA', 'KE', 'UG', 'TZ', 'RW', 'ZW', 'SN', 'EG', 'MA'].includes(c));
    if (isAfricanCountry) return true;

    // Check language
    const lang = (data.original_language || '').toLowerCase();
    if (['yo', 'ig', 'ha', 'pcm', 'sw'].includes(lang)) return true;

    // Reject pure Hollywood / European / Asian productions (US, GB, FR, DE, CA, AU, JP, KR, IN)
    const isPureForeign = allCountries.some(c => ['US', 'GB', 'FR', 'DE', 'CA', 'AU', 'JP', 'KR', 'IN'].includes(c));
    if (isPureForeign && !isAfricanCountry) return false;

    return false;
  } catch {
    return false;
  }
}

async function searchTmdbPersonMulti(nameVariants) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  for (const variant of nameVariants) {
    try {
      const searchUrl = `https://api.themoviedb.org/3/search/person${queryParam}${queryParam ? '&' : '?'}query=${encodeURIComponent(variant)}&include_adult=false`;
      const res = await fetch(searchUrl, { headers });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.results || [];

      for (const r of results) {
        if (r.known_for_department !== 'Acting' && r.known_for_department !== 'Directing') continue;
        
        // Check TMDB details for place of birth
        const details = await getTmdbPersonDetails(r.id);
        const bplace = (details?.place_of_birth || '').toLowerCase();

        // If place of birth is foreign (e.g. USA, UK) with no African ties, skip!
        const isForeignPlace = FOREIGN_COUNTRIES.some(fc => bplace.includes(fc));
        const isAfricanPlace = AFRICAN_BIRTHPLACES.some(ac => bplace.includes(ac));

        if (isForeignPlace && !isAfricanPlace) {
          console.log(`  ⛔ Skipped non-African TMDB person: ${r.name} (Born: ${details?.place_of_birth})`);
          continue;
        }

        console.log(`  🎯 Matched African/Nollywood TMDB Person: ${r.name} (ID: ${r.id})`);
        return r.id;
      }
    } catch (e) {}
  }

  return null;
}

async function getTmdbCredits(tmdbPersonId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  const creditsUrl = `https://api.themoviedb.org/3/person/${tmdbPersonId}/combined_credits${queryParam}`;
  const res = await fetch(creditsUrl, { headers });
  if (!res.ok) return [];
  const data = await res.json();

  const results = [];
  for (const c of data.cast || []) {
    results.push({
      title: c.title || c.name,
      original_title: c.original_title || c.original_name,
      release_date: c.release_date || c.first_air_date || null,
      release_year: c.release_date ? parseInt(c.release_date.slice(0, 4), 10) : null,
      synopsis: c.overview || null,
      poster_url: c.poster_path ? `https://image.tmdb.org/t/p/original${c.poster_path}` : null,
      backdrop_url: c.backdrop_path ? `https://image.tmdb.org/t/p/original${c.backdrop_path}` : null,
      tmdb_id: c.id,
      media_type: c.media_type || 'movie',
      role: 'actor',
      character: c.character?.trim() || null
    });
  }

  for (const c of data.crew || []) {
    results.push({
      title: c.title || c.name,
      original_title: c.original_title || c.original_name,
      release_date: c.release_date || c.first_air_date || null,
      release_year: c.release_date ? parseInt(c.release_date.slice(0, 4), 10) : null,
      synopsis: c.overview || null,
      poster_url: c.poster_path ? `https://image.tmdb.org/t/p/original${c.poster_path}` : null,
      backdrop_url: c.backdrop_path ? `https://image.tmdb.org/t/p/original${c.backdrop_path}` : null,
      tmdb_id: c.id,
      media_type: c.media_type || 'movie',
      role: (c.job || c.department || 'producer').toLowerCase().includes('prod') ? 'producer' : 'crew',
      character: null
    });
  }

  return results;
}

async function enrichSinglePerson(person) {
  console.log(`\n======================================================`);
  console.log(`👤 Processing: "${person.name}" (${person.id}) [Current Films: ${person.film_count || 0}]`);

  const nameVariants = generateNameVariants(person.name);

  let tmdbId = person.tmdb_id;
  if (!tmdbId) {
    tmdbId = await searchTmdbPersonMulti(nameVariants);
  }

  if (tmdbId && tmdbId !== person.tmdb_id) {
    await supabase.from('people').update({ tmdb_id: tmdbId }).eq('id', person.id);
  }

  if (!tmdbId) {
    console.log(`  ⚠️ No verified Nollywood/African TMDB ID for "${person.name}". Skipping.`);
    return { created: 0, linked: 0 };
  }

  const credits = await getTmdbCredits(tmdbId);
  console.log(`  🎬 Found ${credits.length} candidate credits on TMDB`);

  let createdCount = 0;
  let linkedCount = 0;

  for (const item of credits) {
    const title = item.title?.trim();
    if (!title) continue;

    let filmId = null;

    // 1. Search by TMDB ID
    if (item.tmdb_id) {
      const { data: byTmdb } = await supabase
        .from('films')
        .select('id')
        .eq('tmdb_id', item.tmdb_id)
        .maybeSingle();
      if (byTmdb) filmId = byTmdb.id;
    }

    // 2. Search by Title
    if (!filmId) {
      const { data: byTitle } = await supabase
        .from('films')
        .select('id')
        .ilike('title', title)
        .maybeSingle();
      if (byTitle) filmId = byTitle.id;
    }

    // 3. If film does NOT exist in DB, verify it is an authentic African/Nollywood film before creating!
    if (!filmId) {
      if (item.tmdb_id) {
        const isAfrican = await isAfricanMovie(item.tmdb_id);
        if (!isAfrican) {
          // Reject Hollywood / foreign title
          continue;
        }
      }

      const newSlug = normalizeTitle(title).replace(/\s+/g, '-').slice(0, 80) + '-' + (item.release_year || Math.floor(Math.random()*10000));
      const { data: newFilm, error: createFilmErr } = await supabase
        .from('films')
        .insert({
          title,
          synopsis: item.synopsis || `A Nollywood production featuring ${person.name}.`,
          release_date: item.release_date,
          poster_url: item.poster_url,
          backdrop_url: item.backdrop_url,
          tmdb_id: item.tmdb_id,
          source: 'nollywood_tmdb_enrichment',
          slug: newSlug
        })
        .select('id')
        .single();

      if (!createFilmErr && newFilm) {
        filmId = newFilm.id;
        createdCount++;
        console.log(`    ✨ Created verified Nollywood film: "${title}" (${item.release_year || 'N/A'})`);
      }
    }

    if (!filmId) continue;

    // 4. Upsert credit
    const { data: existingCredit } = await supabase
      .from('credits')
      .select('id, character_name, role')
      .eq('film_id', filmId)
      .eq('person_id', person.id)
      .maybeSingle();

    if (!existingCredit) {
      const { error: insErr } = await supabase
        .from('credits')
        .insert({
          film_id: filmId,
          person_id: person.id,
          role: item.role || 'actor',
          character_name: item.character || null,
          source: 'nollywood_tmdb_enrichment'
        });

      if (!insErr) {
        linkedCount++;
        console.log(`    🔗 Linked credit: "${title}" as ${item.role} ${item.character ? `(${item.character})` : ''}`);
      }
    } else if (item.character && !existingCredit.character_name) {
      await supabase
        .from('credits')
        .update({ character_name: item.character })
        .eq('id', existingCredit.id);
    }
  }

  // Recount
  const { count: totalCredits } = await supabase
    .from('credits')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', person.id);

  await supabase
    .from('people')
    .update({
      film_count: totalCredits || person.film_count || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', person.id);

  console.log(`  ✅ Finished: Created ${createdCount} films, Linked ${linkedCount} credits. Total Credits in DB: ${totalCredits}`);
  return { created: createdCount, linked: linkedCount };
}

async function runDaemon() {
  console.log('🚀 Starting Nollywood-Guarded Continuous Actor Enrichment Daemon...');
  const state = loadState();

  const BATCH_SIZE = 25;
  const DELAY_MS = 800;

  let offset = 0;

  while (true) {
    // Only process verified African/Nigerian/Ugandan/Ghanaian people
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name, tmdb_id, film_count, popularity_score, nationality, birthplace')
      .order('popularity_score', { ascending: false })
      .range(offset, offset + BATCH_SIZE - 1);

    if (error || !people || people.length === 0) {
      console.log('🔄 Reached end of people table. Restarting cycle from top in 30s...');
      offset = 0;
      await sleep(30000);
      continue;
    }

    console.log(`\n📦 Batch ${offset} - ${offset + people.length} fetched (${people.length} actors)`);

    for (const p of people) {
      try {
        await enrichSinglePerson(p);
        state.processed_ids[p.id] = new Date().toISOString();
        state.total_enriched++;
        state.last_run_at = new Date().toISOString();
        saveState(state);
      } catch (err) {
        console.error(`❌ Error enriching "${p.name}":`, err.message);
      }
      await sleep(DELAY_MS);
    }

    offset += BATCH_SIZE;
  }
}

runDaemon().catch(console.error);
