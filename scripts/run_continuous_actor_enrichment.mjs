/**
 * Continuous Indefinite Actor Enrichment Worker (Multi-Alias & Name Permutation Enabled)
 * Run anytime on background machines:
 *   node scripts/run_continuous_actor_enrichment.mjs
 * Or with custom batch size:
 *   node scripts/run_continuous_actor_enrichment.mjs --batch=20 --delay=800
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

/**
 * Generate intelligent search variants and extracted aliases:
 * - "Olaniyi Afonja (Sanyeri)" -> ["Olaniyi Afonja (Sanyeri)", "Olaniyi Afonja", "Sanyeri"]
 * - "Funke Akindele Bello" -> ["Funke Akindele Bello", "Funke Akindele", "Akindele Funke"]
 * - "Dada Omowunmi" -> ["Dada Omowunmi", "Omowunmi Dada"]
 */
function generateNameVariants(fullName) {
  const variants = new Set();
  const raw = String(fullName || '').trim();
  if (!raw) return [];

  variants.add(raw);

  // 1. Bracketed or quoted aliases e.g. "Name (Alias)" or "Name 'Alias' Name"
  const bracketMatch = raw.match(/^(.*?)\s*[\(\[\'\"]([^\)\]\'\"]+)[\)\]\'\"]/);
  if (bracketMatch) {
    const main = bracketMatch[1].trim();
    const alias = bracketMatch[2].trim();
    if (main) variants.add(main);
    if (alias && alias.length >= 2) variants.add(alias);
  }

  // 2. Remove all non-alpha brackets/titles e.g. "Chief", "Dr.", "Alhaji", "Prince"
  const cleaned = raw.replace(/\b(chief|dr|alhaji|alhaja|prince|princess|pastor|evangelist|ambassador|mrs|mr|ms)\.?\s+/gi, '').trim();
  if (cleaned && cleaned !== raw) {
    variants.add(cleaned);
  }

  // 3. Deaccented
  const deaccented = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  variants.add(deaccented);

  // 4. Name order permutations for 2 or 3-word names
  const words = cleaned.split(/\s+/).filter(w => w.length > 1);
  if (words.length === 2) {
    variants.add(`${words[1]} ${words[0]}`);
  } else if (words.length === 3) {
    // e.g. "Mercy Johnson Okojie" -> "Mercy Johnson", "Johnson Mercy"
    variants.add(`${words[0]} ${words[1]}`);
    variants.add(`${words[1]} ${words[0]}`);
    variants.add(`${words[2]} ${words[0]} ${words[1]}`);
  }

  return Array.from(variants);
}

/**
 * Search TMDB across all generated name variants and aliases
 */
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

      if (results.length > 0) {
        // Prioritize department = 'Acting' or 'Directing' or 'Production'
        const best = results.find(r => r.known_for_department === 'Acting') || results[0];
        if (best) {
          console.log(`  🎯 Matched TMDB via variant "${variant}": ${best.name} (ID: ${best.id})`);
          return best.id;
        }
      }
    } catch (e) {
      // Continue to next variant
    }
  }

  return null;
}

/**
 * Optional Fallback: Find IMDb ID via name query if TMDB name search fails
 */
async function searchImdbPersonMulti(nameVariants) {
  if (!firecrawlKey && !zenrowsKey) return null;

  for (const variant of nameVariants.slice(0, 2)) {
    try {
      const targetUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(variant)}&s=nm`;
      let html = '';

      if (zenrowsKey) {
        const apiUrl = `https://api.zenrows.com/v1/?apikey=${zenrowsKey}&url=${encodeURIComponent(targetUrl)}&js_render=true&premium_proxy=true`;
        const res = await fetch(apiUrl);
        if (res.ok) html = await res.text();
      }

      if (!html && firecrawlKey) {
        const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${firecrawlKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: targetUrl, formats: ['html'] })
        });
        const data = await res.json();
        html = data.data?.html || '';
      }

      const match = html.match(/\/name\/(nm\d{6,9})/);
      if (match) {
        const imdbId = match[1];
        console.log(`  🎬 Matched IMDb ID via search "${variant}": ${imdbId}`);
        return imdbId;
      }
    } catch {}
  }

  return null;
}

/**
 * Resolve TMDB ID from an IMDb name ID (nm...)
 */
async function findTmdbByImdbId(imdbId) {
  const headers = tmdbToken 
    ? { 'Authorization': `Bearer ${tmdbToken}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
  const queryParam = tmdbKey ? `?api_key=${tmdbKey}` : '';

  try {
    const url = `https://api.themoviedb.org/3/find/${imdbId}${queryParam}${queryParam ? '&' : '?'}external_source=imdb_id`;
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const person = data.person_results?.[0];
    return person ? person.id : null;
  } catch {
    return null;
  }
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
  console.log(`👤 Processing: "${person.name}" (${person.id}) [Current Film Count: ${person.film_count || 0}]`);

  const nameVariants = generateNameVariants(person.name);
  console.log(`  🔍 Search Variants / Aliases (${nameVariants.length}): ${nameVariants.join(' | ')}`);

  let tmdbId = person.tmdb_id;

  // Step 1: Resolve TMDB ID across all name variants and aliases
  if (!tmdbId) {
    tmdbId = await searchTmdbPersonMulti(nameVariants);
  }

  // Step 2: Fallback to IMDb search by Name & Aliases if TMDB is not found
  if (!tmdbId) {
    const imdbId = await searchImdbPersonMulti(nameVariants);
    if (imdbId) {
      tmdbId = await findTmdbByImdbId(imdbId);
      if (tmdbId) {
        console.log(`  🎯 Resolved TMDB ID ${tmdbId} from IMDb ID ${imdbId}`);
      }
    }
  }

  if (tmdbId && tmdbId !== person.tmdb_id) {
    await supabase.from('people').update({ tmdb_id: tmdbId }).eq('id', person.id);
  }

  if (!tmdbId) {
    console.log(`  ⚠️ No TMDB or IMDb match found across any name variants for "${person.name}". Skipping.`);
    return { created: 0, linked: 0 };
  }

  const credits = await getTmdbCredits(tmdbId);
  console.log(`  🎬 Found ${credits.length} credits for TMDB ID: ${tmdbId}`);

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

    // 2. Search by title
    if (!filmId) {
      const { data: byTitle } = await supabase
        .from('films')
        .select('id')
        .ilike('title', title)
        .maybeSingle();
      if (byTitle) filmId = byTitle.id;
    }

    // 3. Create film if missing
    if (!filmId) {
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
          source: 'tmdb_continuous_worker',
          slug: newSlug
        })
        .select('id')
        .single();

      if (!createFilmErr && newFilm) {
        filmId = newFilm.id;
        createdCount++;
        console.log(`    ✨ Created missing film: "${title}" (${item.release_year || 'N/A'})`);
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
          source: 'tmdb_continuous_worker'
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

  // Recount total credits
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
  console.log('🚀 Starting Indefinite Continuous Actor Enrichment Daemon (Multi-Alias & Name Enabled)...');
  const state = loadState();

  const BATCH_SIZE = 25;
  const DELAY_MS = 600;

  let offset = 0;

  while (true) {
    // Select ALL actors in the database, ordered by popularity
    const { data: people, error } = await supabase
      .from('people')
      .select('id, name, tmdb_id, film_count, popularity_score')
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
