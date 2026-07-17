/**
 * PartyJollof TV → MuviDB Enrichment Scraper v2
 * ================================================
 * - Uses the /api/movies JSON API (no HTML scraping for films)
 * - Filters African films only (NG, GH, ZA, KE, TZ, CM, ET, SN, CI)
 * - Extracts cast/crew slugs from film HTML pages
 * - Scrapes person detail pages for bio, photo, birthday, etc.
 * - Uses SmartProxy for IP rotation
 *
 * Run: node scripts/partyjollof_scraper.mjs
 */

import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in environment');
  process.exit(1);
}

const PROXY_USER = process.env.SMARTPROXY_USER;
const PROXY_PASS = process.env.SMARTPROXY_PASS;

const PJ_BASE    = process.env.FEED_THETA_BASE_URL || 'https://www.partyjolloftv.com';
const PJ_IMG     = process.env.FEED_THETA_BASE_URL || 'https://www.partyjolloftv.com';   // poster URLs are relative

// African country codes to target
const AFRICAN_COUNTRIES = ['NG', 'GH', 'ZA', 'KE', 'TZ', 'CM', 'ET', 'SN', 'CI', 'EG', 'RW', 'UG'];

// Limits
const MAX_FILMS_PER_COUNTRY = 5000;  // up to 5000 per country
const MAX_PEOPLE             = 50000; // person pages to scrape
const DELAY_MS               = 1200; // ms between requests

// ─────────────────────────────────────────────
// Supabase
// ─────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ─────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────
const proxyAuth = (PROXY_USER && PROXY_PASS)
  ? Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64')
  : '';

async function fetchText(url, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 25000);
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      };
      if (proxyAuth) {
        headers['Proxy-Authorization'] = `Basic ${proxyAuth}`;
      }
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt < retries) await sleep(1500 * attempt);
    }
  }
  // fallback without proxy
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MuviDBBot/2.0)', 'Accept': '*/*' },
    });
    return await res.text();
  } catch { return null; }
}

async function fetchJSON(url) {
  const text = await fetchText(url);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─────────────────────────────────────────────
// Slug generator
// ─────────────────────────────────────────────
function makeSlug(text) {
  if (!text) return null;
  return text.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '').trim()
    .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// ─────────────────────────────────────────────
// PHASE 1 — Collect African film IDs from API
// ─────────────────────────────────────────────
async function collectAfricanFilms() {
  console.log('\n📋 Fetching African films from Feed Theta API...');
  const seen = new Set();
  const films = [];

  for (const country of AFRICAN_COUNTRIES) {
    let page = 1;
    let fetched = 0;

    while (fetched < MAX_FILMS_PER_COUNTRY) {
      const url = `${PJ_BASE}/api/movies?where[countryOfOrigin][equals]=${country}&limit=100&page=${page}&sort=-createdAt`;
      const data = await fetchJSON(url);
      if (!data?.docs?.length) break;

      for (const doc of data.docs) {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          films.push(doc);
        }
      }
      fetched += data.docs.length;
      console.log(`  [${country}] page ${page}: ${data.docs.length} films (total so far: ${films.length})`);

      if (!data.hasNextPage || fetched >= MAX_FILMS_PER_COUNTRY) break;
      page++;
      await sleep(DELAY_MS);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\n✅ Total unique African films collected: ${films.length}`);
  return films;
}

// ─────────────────────────────────────────────
// PHASE 2 — Get full film detail + cast from API
// ─────────────────────────────────────────────
async function getFilmDetail(filmId) {
  return fetchJSON(`${PJ_BASE}/api/movies/${filmId}`);
}

// ─────────────────────────────────────────────
// PHASE 3 — Extract people slugs from film HTML
// ─────────────────────────────────────────────
async function getPeopleFromFilmPage(pjSlug) {
  const html = await fetchText(`${PJ_BASE}/movies/${pjSlug}`);
  if (!html) return [];

  const $ = cheerio.load(html);
  const people = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.match(/^\/people\/[a-z0-9-]+$/)) return;
    const slug = href.replace('/people/', '').trim();
    const name = $(el).text().trim();
    if (slug && !people.find(p => p.slug === slug)) {
      people.push({ slug, name });
    }
  });

  return people;
}

// ─────────────────────────────────────────────
// PHASE 4 — Scrape person detail page
// ─────────────────────────────────────────────
async function scrapePersonPage(slug) {
  const html = await fetchText(`${PJ_BASE}/people/${slug}`);
  if (!html) return null;

  const $ = cheerio.load(html);

  const name = $('meta[property="og:title"]').attr('content')?.replace(' | PartyJollof TV', '').trim()
    || $('h1').first().text().trim();
  const photoUrl = $('meta[property="og:image"]').attr('content');
  const metaDesc = $('meta[property="og:description"]').attr('content')?.trim()
    || $('meta[name="description"]').attr('content')?.trim();

  if (!name) return null;

  const bodyText = $('body').text();

  // Biography — look for extended bio text
  let bio = metaDesc || null;
  const bioMatch = bodyText.match(/Biography\s+([\s\S]{80,800}?)(?:Known For|Social|Filmography|Credits|Born)/i);
  if (bioMatch) bio = bioMatch[1].trim().replace(/\s+/g, ' ').substring(0, 800);

  // Date of birth
  let dateOfBirth = null;
  const dobMatch = bodyText.match(/(?:Born|Birth\s*Date|Date\s*of\s*Birth)\s*[:\n]?\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/i);
  if (dobMatch) dateOfBirth = dobMatch[1].trim();

  // Birthplace
  let birthplace = null;
  const bpMatch = bodyText.match(/(?:Place\s*of\s*Birth|Born\s*in)\s*[:\n]?\s*([^\n\.]{3,80})/i);
  if (bpMatch) birthplace = bpMatch[1].trim();

  // Known for department
  let knownForDept = 'Acting';
  if (/director/i.test(bodyText)) knownForDept = 'Directing';
  else if (/producer/i.test(bodyText)) knownForDept = 'Production';
  else if (/writer|screenplay/i.test(bodyText)) knownForDept = 'Writing';

  // Films this person appears in (from page links)
  const filmography = [];
  $('a[href*="/movies/"]').each((_, el) => {
    const title = $(el).text().trim();
    const href = $(el).attr('href') || '';
    if (title && href && title.length > 2 && title.length < 120) {
      const pjFilmSlug = href.split('/movies/')[1]?.split('#')[0]?.split('?')[0];
      if (pjFilmSlug && !filmography.find(f => f.pjSlug === pjFilmSlug)) {
        filmography.push({ title, pjSlug: pjFilmSlug });
      }
    }
  });

  return {
    name,
    bio,
    photo_url: photoUrl,
    date_of_birth: dateOfBirth,
    birthplace,
    known_for_department: knownForDept,
    mubi_slug: makeSlug(name),
    source_slug: slug,
    filmography: filmography.slice(0, 30),
  };
}

// ─────────────────────────────────────────────
// DB: Upsert film
// ─────────────────────────────────────────────
async function upsertFilm(apiFilm) {
  // Prefer original Uploadthing asset (_key) — sizes.og is often a 1200x630 landscape crop.
  const UFS = 'https://1s8yfxw74q.ufs.sh/f';
  const posterUrl = apiFilm.poster?._key
    ? `${UFS}/${apiFilm.poster._key}`
    : apiFilm.poster?.sizes?.og?._key
      ? `${UFS}/${apiFilm.poster.sizes.og._key}`
      : apiFilm.poster?.url
        ? (String(apiFilm.poster.url).startsWith('http') ? apiFilm.poster.url : `${PJ_IMG}${apiFilm.poster.url}`)
        : null;

  const releaseYear = apiFilm.releaseDate
    ? new Date(apiFilm.releaseDate).getFullYear()
    : null;

  const isInCinemas = apiFilm.watchAvailability?.inCinemas?.isInCinemas === true;
  const streamingLinks = (apiFilm.watchAvailability?.streaming || []).map(s => ({
    platform: s.platform,
    url: s.url,
  }));

  // PartyJollof genres map based on their frontend (we can fallback to extracting from known list)
  const GENRE_MAP = {
    1: 'Drama', 2: 'Comedy', 3: 'Action', 4: 'Thriller', 5: 'Romance', 
    6: 'Horror', 7: 'Documentary', 8: 'Sci-Fi', 9: 'Fantasy', 10: 'Family'
  };
  const extractedGenres = (apiFilm.genres || []).map(id => typeof id === 'object' ? id.name : GENRE_MAP[id]).filter(Boolean);

  const payload = {
    title: apiFilm.title?.trim(),
    synopsis: apiFilm.overview || null,
    poster_url: posterUrl,
    year: releaseYear,
    release_date: apiFilm.releaseDate || null,
    runtime_minutes: apiFilm.runtime || null,
    is_nollywood: ['NG'].includes(apiFilm.countryOfOrigin),
    is_in_cinemas: isInCinemas,
    mubi_slug: makeSlug(apiFilm.title),
    slug: makeSlug(apiFilm.title),
    countries: apiFilm.countryOfOrigin ? [apiFilm.countryOfOrigin] : null,
    genres: extractedGenres.length > 0 ? extractedGenres : null,
  };
  if (streamingLinks.length) payload.streaming_links = streamingLinks;

  // Remove nulls
  Object.keys(payload).forEach(k => (payload[k] === null || payload[k] === undefined) && delete payload[k]);

  // Find existing by title (case-insensitive)
  const { data: existing } = await supabase
    .from('films')
    .select('id, title, synopsis, poster_url, mubi_slug, slug, genres')
    .ilike('title', payload.title)
    .maybeSingle();

  if (existing) {
    const updates = {};
    if (!existing.synopsis   && payload.synopsis)   updates.synopsis   = payload.synopsis;
    if (payload.poster_url)                         updates.poster_url = payload.poster_url; // ALWAYS override with PartyJollof HD poster
    if (!existing.mubi_slug  && payload.mubi_slug)   updates.mubi_slug  = payload.mubi_slug;
    if (!existing.slug       && payload.slug)        updates.slug       = payload.slug;
    if ((!existing.genres || existing.genres.length === 0) && payload.genres) updates.genres = payload.genres;

    if (Object.keys(updates).length) {
      await supabase.from('films').update(updates).eq('id', existing.id);
      return { action: 'enriched', id: existing.id };
    }
    return { action: 'skipped', id: existing.id };
  }

  // Insert new
  const { data, error } = await supabase.from('films').insert(payload).select('id').single();
  if (error) {
    // mubi_slug conflict — retry without it
    if (error.code === '23505') {
      delete payload.mubi_slug;
      delete payload.slug;
      const { data: d2, error: e2 } = await supabase.from('films').insert(payload).select('id').single();
      if (e2) return { action: 'error', error: e2.message };
      return { action: 'inserted', id: d2.id };
    }
    return { action: 'error', error: error.message };
  }
  return { action: 'inserted', id: data.id };
}

// ─────────────────────────────────────────────
// DB: Upsert person
// ─────────────────────────────────────────────
async function upsertPerson(person) {
  const payload = {
    name: person.name,
    bio: person.bio || null,
    photo_url: person.photo_url || null,
    date_of_birth: person.date_of_birth || null,
    birthplace: person.birthplace || null,
    known_for_department: person.known_for_department || 'Acting',
    mubi_slug: person.mubi_slug || null,
    slug: person.mubi_slug || null,
  };

  Object.keys(payload).forEach(k => (payload[k] === null || payload[k] === undefined) && delete payload[k]);

  // Find existing by name
  const { data: existing } = await supabase
    .from('people')
    .select('id, name, bio, photo_url, mubi_slug, slug')
    .ilike('name', person.name)
    .maybeSingle();

  if (existing) {
    const updates = {};
    if (!existing.bio       && person.bio)       updates.bio       = person.bio;
    if (!existing.photo_url && person.photo_url) updates.photo_url = person.photo_url;
    if (!existing.mubi_slug && person.mubi_slug) updates.mubi_slug = person.mubi_slug;
    if (!existing.slug       && person.mubi_slug) updates.slug       = person.mubi_slug;
    if (person.date_of_birth && !existing.date_of_birth) updates.date_of_birth = person.date_of_birth;
    if (person.birthplace    && !existing.birthplace)    updates.birthplace    = person.birthplace;

    if (Object.keys(updates).length) {
      await supabase.from('people').update(updates).eq('id', existing.id);
      return { action: 'enriched', id: existing.id };
    }
    return { action: 'skipped', id: existing.id };
  }

  const { data, error } = await supabase.from('people').insert(payload).select('id').single();
  if (error) {
    if (error.code === '23505') {
      delete payload.mubi_slug;
      delete payload.slug;
      const { data: d2, error: e2 } = await supabase.from('people').insert(payload).select('id').single();
      if (e2) return { action: 'error', error: e2.message };
      return { action: 'inserted', id: d2.id };
    }
    return { action: 'error', error: error.message };
  }
  return { action: 'inserted', id: data.id };
}

// ─────────────────────────────────────────────
// DB: Upsert credit
// ─────────────────────────────────────────────
async function upsertCredit(filmId, personId, role) {
  const { data: existing } = await supabase
    .from('credits')
    .select('id')
    .eq('film_id', filmId)
    .eq('person_id', personId)
    .eq('role', role)
    .maybeSingle();

  if (existing) return { action: 'skipped' };

  const { error } = await supabase.from('credits').insert({
    film_id: filmId,
    person_id: personId,
    role: role
  });
  
  if (error) return { action: 'error', error: error.message };
  return { action: 'inserted' };
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────
async function main() {
  console.log('🚀 MuviDB ← Feed Theta Enrichment Scraper v2');
  console.log('═'.repeat(55));
  console.log(`📡 SmartProxy active`);
  console.log(`🌍 Countries: ${AFRICAN_COUNTRIES.join(', ')}`);
  console.log(`📦 Supabase: ${SUPABASE_URL}\n`);

  const stats = {
    films:  { inserted: 0, enriched: 0, skipped: 0, errors: 0 },
    people: { inserted: 0, enriched: 0, skipped: 0, errors: 0 },
    credits: { inserted: 0, skipped: 0, errors: 0 },
  };
  const allErrors = [];
  const processedPeople = new Set(); // slugs already scraped
  const relationships = []; // to hold { filmId, personSlug }

  // ── Step 1: collect film list ──────────────
  const filmDocs = await collectAfricanFilms();

  // ── Step 2: process each film ──────────────
  console.log('\n═══ PHASE 1: FILMS + CAST/CREW ═══\n');

  for (let i = 0; i < filmDocs.length; i++) {
    const doc = filmDocs[i];
    process.stdout.write(`[${i + 1}/${filmDocs.length}] "${doc.title}" (${doc.countryOfOrigin})... `);

    // Get full detail from API for cast/crew
    const detail = await getFilmDetail(doc.id);
    const film = detail || doc; // fallback to listing doc

    // Upsert film
    const filmResult = await upsertFilm(film);
    if (filmResult.action === 'inserted') {
      process.stdout.write('✅ Inserted');
      stats.films.inserted++;
    } else if (filmResult.action === 'enriched') {
      process.stdout.write('🔄 Enriched');
      stats.films.enriched++;
    } else if (filmResult.action === 'skipped') {
      process.stdout.write('⏭ Skipped');
      stats.films.skipped++;
    } else {
      process.stdout.write(`❌ ${filmResult.error}`);
      stats.films.errors++;
      allErrors.push({ type: 'film', title: doc.title, error: filmResult.error });
    }

    // Extract cast/crew count from API
    const castCount = film.cast?.length || 0;
    const crewCount = film.crew?.length || 0;

    if (castCount + crewCount > 0) {
      // Get person slugs from film HTML page
      await sleep(500);
      const personSlugs = await getPeopleFromFilmPage(film.slug || `${makeSlug(film.title)}-${film.id}`);
      process.stdout.write(` | 👥 ${personSlugs.length} people\n`);

      // Queue unique people for scraping
      for (const p of personSlugs) {
        if (!processedPeople.has(p.slug)) {
          processedPeople.add(p.slug);
        }
        if (filmResult.id) {
          relationships.push({ filmId: filmResult.id, personSlug: p.slug });
        }
      }
    } else {
      process.stdout.write(` | 👥 no cast\n`);
    }

    await sleep(DELAY_MS);
  }

  // ── Step 3: scrape all collected people ────
  console.log(`\n\n═══ PHASE 2: PEOPLE (${processedPeople.size} unique) ═══\n`);

  const peopleSlugs = Array.from(processedPeople).slice(0, MAX_PEOPLE);

  for (let i = 0; i < peopleSlugs.length; i++) {
    const slug = peopleSlugs[i];
    process.stdout.write(`[${i + 1}/${peopleSlugs.length}] /people/${slug}... `);

    const person = await scrapePersonPage(slug);
    if (!person) {
      console.log('⚠️ Could not parse');
      stats.people.errors++;
      continue;
    }

    const result = await upsertPerson(person);
    if (result.action === 'inserted') {
      console.log(`✅ ${person.name}`);
      stats.people.inserted++;
    } else if (result.action === 'enriched') {
      console.log(`🔄 ${person.name} (enriched)`);
      stats.people.enriched++;
    } else if (result.action === 'skipped') {
      console.log(`⏭ ${person.name} (complete)`);
      stats.people.skipped++;
    } else {
      console.log(`❌ ${person.name}: ${result.error}`);
      stats.people.errors++;
      allErrors.push({ type: 'person', slug, error: result.error });
    }

    if (result.id) {
      // Link to credits
      const rels = relationships.filter(r => r.personSlug === slug);
      let role = 'Actor';
      if (person.known_for_department === 'Directing') role = 'Director';
      else if (person.known_for_department === 'Writing') role = 'Writer';
      else if (person.known_for_department === 'Production') role = 'Producer';

      for (const rel of rels) {
        const credRes = await upsertCredit(rel.filmId, result.id, role);
        if (credRes.action === 'inserted') stats.credits.inserted++;
        else if (credRes.action === 'skipped') stats.credits.skipped++;
        else {
          stats.credits.errors++;
          allErrors.push({ type: 'credit', slug, error: credRes.error });
        }
      }
    }

    await sleep(DELAY_MS);
  }

  // ── Final report ───────────────────────────
  console.log('\n\n' + '═'.repeat(55));
  console.log('📊 FINAL REPORT');
  console.log('═'.repeat(55));
  console.log('\n🎬 Films:');
  console.log(`   ✅ Inserted : ${stats.films.inserted}`);
  console.log(`   🔄 Enriched : ${stats.films.enriched}`);
  console.log(`   ⏭  Skipped  : ${stats.films.skipped}`);
  console.log(`   ❌ Errors   : ${stats.films.errors}`);
  console.log('\n👥 People:');
  console.log(`   ✅ Inserted : ${stats.people.inserted}`);
  console.log(`   🔄 Enriched : ${stats.people.enriched}`);
  console.log(`   ⏭  Skipped  : ${stats.people.skipped}`);
  console.log(`   ❌ Errors   : ${stats.people.errors}`);
  console.log('\n🔗 Credits:');
  console.log(`   ✅ Inserted : ${stats.credits.inserted}`);
  console.log(`   ⏭  Skipped  : ${stats.credits.skipped}`);
  console.log(`   ❌ Errors   : ${stats.credits.errors}`);

  const total = stats.films.inserted + stats.films.enriched + stats.people.inserted + stats.people.enriched + stats.credits.inserted;
  console.log(`\n🎯 Total DB changes: ${total}`);

  if (allErrors.length) {
    console.log(`\n⚠️  ${allErrors.length} errors. First 5:`);
    allErrors.slice(0, 5).forEach(e => console.log(`   - [${e.type}] ${e.title || e.slug}: ${e.error}`));
  }

  console.log('\n✅ Scrape complete!\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
