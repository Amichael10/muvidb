/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         LUMI — African Film Sync (Mubi v4 API)          ║
 * ║                                                          ║
 * ║  Phase 1: Discover all African films per country         ║
 * ║           via api.mubi.com/v4/browse/films               ║
 * ║  Phase 2: Upsert each film + cast + genres into Supabase ║
 * ║                                                          ║
 * ║  Usage:  node mubi_africa_sync.cjs                       ║
 * ║  Resume: node mubi_africa_sync.cjs  (auto-resumes)       ║
 * ╚══════════════════════════════════════════════════════════╝
 */

'use strict';

const { createClient } = require('@supabase/supabase-js');
const fs   = require('fs');
const path = require('path');
require('dotenv').config();

// ─── Supabase ──────────────────────────────────────────────
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ─── Config ────────────────────────────────────────────────
const STATE_FILE          = path.join(__dirname, 'mubi_africa_state.json');
const DELAY_MS            = 1200;   // delay between film upserts (be polite)
const PAGE_DELAY_MS       = 600;    // delay between pagination requests
const RATE_LIMIT_WAIT_MS  = 90000;  // 90s cooldown on HTTP 429

// ─── All 54 African countries with their ISO codes ─────────
const AFRICAN_COUNTRIES = [
  { name: 'Algeria',                   code: 'DZ' },
  { name: 'Angola',                    code: 'AO' },
  { name: 'Benin',                     code: 'BJ' },
  { name: 'Botswana',                  code: 'BW' },
  { name: 'Burkina Faso',              code: 'BF' },
  { name: 'Burundi',                   code: 'BI' },
  { name: 'Cabo Verde',                code: 'CV' },
  { name: 'Cameroon',                  code: 'CM' },
  { name: 'Central African Republic',  code: 'CF' },
  { name: 'Chad',                      code: 'TD' },
  { name: 'Comoros',                   code: 'KM' },
  { name: 'Congo',                     code: 'CG' },
  { name: 'Congo (DRC)',               code: 'CD' },
  { name: 'Djibouti',                  code: 'DJ' },
  { name: 'Egypt',                     code: 'EG' },
  { name: 'Equatorial Guinea',         code: 'GQ' },
  { name: 'Eritrea',                   code: 'ER' },
  { name: 'Eswatini',                  code: 'SZ' },
  { name: 'Ethiopia',                  code: 'ET' },
  { name: 'Gabon',                     code: 'GA' },
  { name: 'Gambia',                    code: 'GM' },
  { name: 'Ghana',                     code: 'GH' },
  { name: 'Guinea',                    code: 'GN' },
  { name: 'Guinea-Bissau',             code: 'GW' },
  { name: 'Ivory Coast',               code: 'CI' },
  { name: 'Kenya',                     code: 'KE' },
  { name: 'Lesotho',                   code: 'LS' },
  { name: 'Liberia',                   code: 'LR' },
  { name: 'Libya',                     code: 'LY' },
  { name: 'Madagascar',                code: 'MG' },
  { name: 'Malawi',                    code: 'MW' },
  { name: 'Mali',                      code: 'ML' },
  { name: 'Mauritania',                code: 'MR' },
  { name: 'Mauritius',                 code: 'MU' },
  { name: 'Morocco',                   code: 'MA' },
  { name: 'Mozambique',                code: 'MZ' },
  { name: 'Namibia',                   code: 'NA' },
  { name: 'Niger',                     code: 'NE' },
  { name: 'Nigeria',                   code: 'NG' },
  { name: 'Rwanda',                    code: 'RW' },
  { name: 'Sao Tome and Principe',     code: 'ST' },
  { name: 'Senegal',                   code: 'SN' },
  { name: 'Seychelles',                code: 'SC' },
  { name: 'Sierra Leone',              code: 'SL' },
  { name: 'Somalia',                   code: 'SO' },
  { name: 'South Africa',              code: 'ZA' },
  { name: 'South Sudan',               code: 'SS' },
  { name: 'Sudan',                     code: 'SD' },
  { name: 'Tanzania',                  code: 'TZ' },
  { name: 'Togo',                      code: 'TG' },
  { name: 'Tunisia',                   code: 'TN' },
  { name: 'Uganda',                    code: 'UG' },
  { name: 'Zambia',                    code: 'ZM' },
  { name: 'Zimbabwe',                  code: 'ZW' },
];

const AFRICAN_COUNTRY_NAMES = new Set(AFRICAN_COUNTRIES.map(c => c.name));

// ─── State Management ──────────────────────────────────────
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      return {
        discovered_countries: new Set(raw.discovered_countries || []),
        pending_films:        raw.pending_films        || [],   // [{slug,mubi_id,film_data}]
        processed_mubi_ids:   new Set(raw.processed_mubi_ids || []),
        stats: raw.stats || { inserted: 0, updated: 0, skipped: 0, errors: 0 },
      };
    } catch (e) {
      console.error('⚠️  Could not parse state file, starting fresh:', e.message);
    }
  }
  return {
    discovered_countries: new Set(),
    pending_films:        [],
    processed_mubi_ids:   new Set(),
    stats: { inserted: 0, updated: 0, skipped: 0, errors: 0 },
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    discovered_countries: [...state.discovered_countries],
    pending_films:        state.pending_films,
    processed_mubi_ids:   [...state.processed_mubi_ids],
    stats:                state.stats,
    last_saved:           new Date().toISOString(),
  }, null, 2));
}

// ─── HTTP Helper ───────────────────────────────────────────
const BASE_HEADERS = {
  'User-Agent':          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept':              'application/json',
  'Accept-Language':     'en-US,en;q=0.9',
  'Referer':             'https://mubi.com/',
  'Origin':              'https://mubi.com',
  'client':              'web',
  'Client-Accept-Video-Codecs': 'vp9,h264',
  'Client-Accept-Audio-Codecs': 'aac',
  'anonymous_user_id':   '297956f1-8b81-4528-963b-16a856d73fc9',
};

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function apiFetch(url, isoCode = 'US', retries = 5) {
  const headers = { ...BASE_HEADERS, 'Client-Country': isoCode };
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });

      if (res.status === 429) {
        console.log(`  🛑 Rate limited! Cooling down for ${RATE_LIMIT_WAIT_MS / 1000}s...`);
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      if (res.status === 404) return null;
      if (!res.ok) {
        console.log(`  ⚠️  HTTP ${res.status} on attempt ${attempt}: ${url.slice(0, 80)}`);
        await sleep(5000 * attempt);
        continue;
      }
      return await res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.log(`  ⚠️  Network error attempt ${attempt}: ${err.message}`);
      await sleep(4000 * attempt);
    }
  }
  return null;
}

// ─── Phase 1: Discover films per country ──────────────────
async function discoverCountry(country, state) {
  if (state.discovered_countries.has(country.name)) {
    process.stdout.write(`  ⏭️  ${country.name} already discovered\n`);
    return 0;
  }

  let page = 1;
  let newFilms = 0;

  while (true) {
    const url = `https://api.mubi.com/v4/browse/films?historic_countries=${encodeURIComponent(country.name)}&page=${page}&per_page=24`;
    const data = await apiFetch(url, country.code);

    if (!data || !data.films || data.films.length === 0) break;

    for (const film of data.films) {
      if (!film.id || state.processed_mubi_ids.has(film.id)) continue;
      // Check if already queued
      if (state.pending_films.some(f => f.mubi_id === film.id)) continue;

      // The v4 API gives us all the data we need right here — no second request!
      state.pending_films.push({
        mubi_id:         film.id,
        slug:            film.slug,
        title:           film.title,
        year:            film.year,
        duration:        film.duration,
        synopsis:        film.short_synopsis || film.default_editorial || '',
        genres:          (film.genres || []),
        poster_url:      film.stills?.standard || film.still_url,
        backdrop_url:    film.stills?.retina   || film.stills?.standard || film.still_url,
        trailer_url:     film.trailer_url || null,
        mubi_rating:     film.average_rating || null,
        historic_countries: (film.historic_countries || []),
        directors:       (film.directors || []).map(d => ({ name: d.name, slug: d.slug })),
        browsed_country: country.name,  // the country we queried for
      });
      newFilms++;
    }

    const meta = data.meta || {};
    console.log(`    📄 ${country.name} page ${page}/${meta.total_pages || '?'}: ${data.films.length} films | +${newFilms} new`);

    if (!meta.next_page) break;
    page++;
    await sleep(PAGE_DELAY_MS);
  }

  state.discovered_countries.add(country.name);
  return newFilms;
}

// ─── Phase 2: Upsert film + people + genres ────────────────

async function upsertPerson(name, mubiSlug) {
  if (!name) return null;

  // Try by mubi_slug first
  if (mubiSlug) {
    const { data } = await supabase.from('people').select('id').eq('mubi_slug', mubiSlug).maybeSingle();
    if (data) return data.id;
  }

  // Try by name
  const { data: byName } = await supabase.from('people').select('id').ilike('name', name).maybeSingle();
  if (byName) {
    if (mubiSlug) await supabase.from('people').update({ mubi_slug: mubiSlug }).eq('id', byName.id);
    return byName.id;
  }

  // Insert new
  const { data: newP, error } = await supabase.from('people')
    .insert({ name, mubi_slug: mubiSlug || null })
    .select('id').single();

  if (error) {
    console.error(`    ⚠️  Person insert error (${name}):`, error.message);
    return null;
  }
  return newP.id;
}

async function syncFilm(film, state) {
  const filmCountries = film.historic_countries || [];
  const isAfrican = filmCountries.some(c => AFRICAN_COUNTRY_NAMES.has(c));

  if (!isAfrican) {
    console.log(`    ⏭️  Non-African: ${film.title} [${filmCountries.join(', ')}]`);
    state.stats.skipped++;
    return;
  }

  // ── Upsert film row ──────────────────────────────────────
  const payload = {
    title:            film.title,
    year:             film.year,
    synopsis:         film.synopsis,
    runtime_minutes:  film.duration || null,
    poster_url:       film.poster_url,
    backdrop_url:     film.backdrop_url,
    trailer_url:      film.trailer_url || null,
    mubi_id:          String(film.mubi_id),
    mubi_slug:        film.slug,
    source:           'mubi',
    status:           'released',
    is_nollywood:     filmCountries.includes('Nigeria'),
    countries:        filmCountries.filter(c => AFRICAN_COUNTRY_NAMES.has(c)),
  };

  const { data: existing } = await supabase.from('films').select('id')
    .or(`mubi_id.eq.${film.mubi_id},mubi_slug.eq.${film.slug}`)
    .maybeSingle();

  let filmId;
  if (existing) {
    filmId = existing.id;
    await supabase.from('films').update(payload).eq('id', filmId);
    state.stats.updated++;
    process.stdout.write(`  🔄 Updated: ${film.title} (${film.year})\n`);
  } else {
    const { data: inserted, error } = await supabase.from('films')
      .insert({ ...payload, source: 'mubi' }).select('id').single();
    if (error) {
      console.error(`  ❌ Insert error (${film.title}):`, error.message);
      state.stats.errors++;
      return;
    }
    filmId = inserted.id;
    state.stats.inserted++;
    process.stdout.write(`  ✅ Inserted: ${film.title} (${film.year}) [${filmCountries.filter(c => AFRICAN_COUNTRY_NAMES.has(c)).join(', ')}]\n`);
  }

  // ── Genres ────────────────────────────────────────────────
  for (const genreName of (film.genres || [])) {
    const { data: genre } = await supabase.from('genres').select('id')
      .ilike('name', genreName).maybeSingle();
    if (genre) {
      await supabase.from('film_genres')
        .upsert({ film_id: filmId, genre_id: genre.id }, { onConflict: 'film_id,genre_id' });
    }
  }

  // ── Directors ─────────────────────────────────────────────
  for (const director of (film.directors || [])) {
    const personId = await upsertPerson(director.name, director.slug);
    if (personId) {
      await supabase.from('credits')
        .upsert({ film_id: filmId, person_id: personId, role: 'director', billing_order: 0 }, { onConflict: 'film_id,person_id,role' });
    }
  }

  // ── Relational country links ───────────────────────────────
  for (const countryName of filmCountries) {
    if (!AFRICAN_COUNTRY_NAMES.has(countryName)) continue;
    const { data: countryRow } = await supabase.from('countries').select('id')
      .eq('name', countryName).maybeSingle();
    if (countryRow) {
      await supabase.from('film_countries')
        .upsert({ film_id: filmId, country_id: countryRow.id }, { onConflict: 'film_id,country_id' });
    }
  }
}

// ─── Main ──────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   LUMI — African Film Sync (Mubi v4)     ║');
  console.log('╚══════════════════════════════════════════╝\n');

  const state = loadState();
  console.log(`📂 State loaded: ${state.pending_films.length} films queued, ${state.processed_mubi_ids.size} already processed\n`);

  // ════ PHASE 1: DISCOVERY ════════════════════════════════
  const undiscovered = AFRICAN_COUNTRIES.filter(c => !state.discovered_countries.has(c.name));

  if (undiscovered.length > 0) {
    console.log(`═══ PHASE 1: DISCOVERY (${undiscovered.length} countries remaining) ═══\n`);
    let totalNew = 0;

    for (const country of undiscovered) {
      process.stdout.write(`🌍 Discovering: ${country.name}...\n`);
      const found = await discoverCountry(country, state);
      totalNew += found;
      if (found > 0) {
        console.log(`  ✅ ${country.name}: ${found} new films queued. Total pending: ${state.pending_films.length}`);
      }
      saveState(state);
      await sleep(500);
    }

    console.log(`\n🏁 Discovery complete! ${totalNew} new films added to queue.`);
  } else {
    console.log('✅ All countries already discovered. Skipping Phase 1.\n');
  }

  // ════ PHASE 2: SYNC ═════════════════════════════════════
  const totalToSync = state.pending_films.length;
  console.log(`\n═══ PHASE 2: SYNC (${totalToSync} films to process) ═══\n`);

  let processed = 0;

  while (state.pending_films.length > 0) {
    const film = state.pending_films.shift();

    if (state.processed_mubi_ids.has(film.mubi_id)) {
      continue; // already done
    }

    const remaining = state.pending_films.length;
    const total     = totalToSync;
    const pct       = Math.round(((total - remaining) / total) * 100);

    process.stdout.write(`\n[${processed + 1}/${total}] (${pct}%) ${film.slug} — ${remaining} remaining\n`);

    try {
      await syncFilm(film, state);
      state.processed_mubi_ids.add(film.mubi_id);
      processed++;
    } catch (err) {
      console.error(`  ❌ Error syncing ${film.slug}:`, err.message);
      state.stats.errors++;
      // Re-queue if not a permanent error
      if (!err.message.includes('duplicate') && !err.message.includes('404')) {
        state.pending_films.push(film);
      }
      await sleep(10000);
    }

    // Save state every 20 films
    if (processed % 20 === 0) {
      saveState(state);
      const { inserted, updated, skipped, errors } = state.stats;
      console.log(`\n  📊 Progress: +${inserted} inserted | ${updated} updated | ${skipped} skipped | ${errors} errors\n`);
    }

    await sleep(DELAY_MS + Math.random() * 500);
  }

  // Final save
  saveState(state);
  const { inserted, updated, skipped, errors } = state.stats;

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║              SYNC COMPLETE!              ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`\n  ✅ Inserted : ${inserted}`);
  console.log(`  🔄 Updated  : ${updated}`);
  console.log(`  ⏭️  Skipped  : ${skipped}`);
  console.log(`  ❌ Errors   : ${errors}`);
  console.log(`\n  Total processed this run: ${processed}`);
}

main().catch(err => {
  console.error('\n💥 Fatal error:', err);
  process.exit(1);
});
