const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { AFRICAN_COUNTRIES } = require('./constants.cjs');

// ─── Config ─────────────────────────────
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const STATE_FILE = 'mubi_sync_state.json';
const SYNC_DELAY_MS = 1500;
const RATE_LIMIT_COOLDOWN_MS = 60000;

// These headers are exactly what Mubi's web frontend sends to its own API
const API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.7727.15 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en',
    'Referer': 'https://mubi.com/',
    'Origin': 'https://mubi.com',
    'Client': 'web',
    'Client-Accept-Video-Codecs': 'vp9,h264',
    'Client-Accept-Audio-Codecs': 'aac',
    'Client-Country': 'US',
    'anonymous_user_id': '297956f1-8b81-4528-963b-16a856d73fc9',
};

// ISO 3166 mapping for the CLIENT_COUNTRY header per browsed country
const COUNTRY_TO_CODE = {
    'Nigeria': 'NG', 'Senegal': 'SN', 'Algeria': 'DZ', 'Cameroon': 'CM',
    'Morocco': 'MA', 'South Africa': 'ZA', 'Egypt': 'EG', 'Ghana': 'GH',
    'Kenya': 'KE', 'Tunisia': 'TN', 'Ethiopia': 'ET', 'Tanzania': 'TZ',
    'Uganda': 'UG', 'Rwanda': 'RW', 'Mali': 'ML', 'Burkina Faso': 'BF',
    'Chad': 'TD', 'Mauritania': 'MR', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
    'Mozambique': 'MZ', 'Madagascar': 'MG', 'Angola': 'AO', 'Benin': 'BJ',
    'Ivory Coast': 'CI', 'Somalia': 'SO', 'Sudan': 'SD', 'South Sudan': 'SS',
    'Libya': 'LY', 'Namibia': 'NA', 'Botswana': 'BW', 'Gabon': 'GA',
    'Togo': 'TG', 'Niger': 'NE', 'Guinea': 'GN', 'Malawi': 'MW',
    'Lesotho': 'LS', 'Liberia': 'LR', 'Sierra Leone': 'SL', 'Eritrea': 'ER',
    'Gambia': 'GM', 'Djibouti': 'DJ', 'Eswatini': 'SZ', 'Congo': 'CG',
    'Congo (DRC)': 'CD', 'Comoros': 'KM', 'Mauritius': 'MU',
    'Seychelles': 'SC', 'Cabo Verde': 'CV', 'Sao Tome and Principe': 'ST',
    'Equatorial Guinea': 'GQ', 'Guinea-Bissau': 'GW', 'Central African Republic': 'CF',
    'Burundi': 'BI',
};

// ─── State ──────────────────────────────
function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            return {
                processed_slugs: new Set(data.processed_slugs || []),
                pending_slugs: data.pending_slugs || [],
                discovered_countries: new Set(data.discovered_countries || []),
            };
        } catch (e) { console.error('Error loading state:', e); }
    }
    return { processed_slugs: new Set(), pending_slugs: [], discovered_countries: new Set() };
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
        processed_slugs: [...state.processed_slugs],
        pending_slugs: state.pending_slugs,
        discovered_countries: [...state.discovered_countries],
    }, null, 2));
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── API Calls ─────────────────────────

async function apiFetch(url, countryCode = 'US') {
    const headers = { ...API_HEADERS, 'Client-Country': countryCode };
    for (let i = 0; i < 5; i++) {
        try {
            const res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
            if (res.status === 429) {
                console.log(`  🛑 Rate limited. Waiting ${RATE_LIMIT_COOLDOWN_MS / 1000}s...`);
                await sleep(RATE_LIMIT_COOLDOWN_MS);
                continue;
            }
            if (res.status === 404) return null;
            if (!res.ok) {
                console.log(`  ⚠️ HTTP ${res.status} for ${url}`);
                await sleep(5000 * (i + 1));
                continue;
            }
            return await res.json();
        } catch (err) {
            if (i === 4) throw err;
            await sleep(5000 * (i + 1));
        }
    }
    return null;
}

// Phase 1: Discover all film slugs for a country via v4 browse API
async function discoverCountry(country, state) {
    if (state.discovered_countries.has(country)) {
        console.log(`  ⏭️  Already discovered: ${country}`);
        return;
    }

    const code = COUNTRY_TO_CODE[country] || 'US';
    let page = 1;
    let totalFound = 0;

    while (true) {
        const url = `https://api.mubi.com/v4/browse/films?sort=popularity_quality_score&country=${encodeURIComponent(country)}&page=${page}&per_page=24`;
        console.log(`  🔍 ${country} page ${page}...`);
        
        const data = await apiFetch(url, code);
        
        if (!data || !data.films || data.films.length === 0) {
            break;
        }

        let added = 0;
        for (const film of data.films) {
            if (film.slug && !state.processed_slugs.has(film.slug) && !state.pending_slugs.includes(film.slug)) {
                state.pending_slugs.push(film.slug);
                added++;
            }
        }
        totalFound += data.films.length;
        
        const meta = data.meta || {};
        console.log(`    ✅ Page ${page}/${meta.total_pages || '?'}: ${data.films.length} films (${added} new queued). Total pending: ${state.pending_slugs.length}`);
        
        if (!meta.next_page) break;
        page++;
        await sleep(800);
    }

    if (totalFound > 0) {
        state.discovered_countries.add(country);
        saveState(state);
        console.log(`  🏁 ${country} done. Total discovered: ${totalFound}`);
    }
}

// Phase 2: Fetch full film detail and sync to DB
async function extractFilmDetail(slug) {
    // Use the Mubi HTML/Next.js endpoint which has full cast+metadata
    const url = `https://mubi.com/en/films/${slug}`;
    try {
        const res = await fetch(url, { 
            headers: { 
                'User-Agent': API_HEADERS['User-Agent'],
                'Accept': 'text/html'
            },
            signal: AbortSignal.timeout(30000)
        });

        if (!res.ok) return null;
        const html = await res.text();
        
        const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (!match) return null;
        
        const nextData = JSON.parse(match[1]);
        const film = nextData?.props?.pageProps?.initFilm || nextData?.props?.pageProps?.film;
        if (!film) return null;

        const credits = [];
        (film.directors || []).forEach(d => credits.push({ name: d.name, role: 'director', mubi_slug: d.slug }));
        (film.cast_members || []).slice(0, 15).forEach(c => credits.push({ name: c.name, role: 'actor', mubi_slug: c.slug }));

        const countries = (film.historic_countries || []).map(c => typeof c === 'string' ? c : c.name).filter(Boolean);

        return {
            metadata: {
                title: film.title,
                year: film.year,
                synopsis: film.short_synopsis || film.synopsis || '',
                runtime_minutes: film.duration,
                genres: (film.genres || []).map(g => typeof g === 'string' ? g : g.name),
                poster_url: film.stills?.large || film.still_url,
                backdrop_url: film.stills?.large,
                mubi_id: film.id,
                mubi_slug: slug,
                countries,
            },
            credits,
        };
    } catch (e) {
        // Fallback to the simple JSON API
        const data = await apiFetch(`https://mubi.com/services/api/films/${slug}`);
        if (!data) return null;
        const countries = (data.historic_countries || []).map(c => typeof c === 'string' ? c : c.name);
        return {
            metadata: {
                title: data.title, year: data.year,
                synopsis: data.synopsis || '',
                runtime_minutes: data.duration,
                genres: [], poster_url: data.still_url,
                backdrop_url: data.stills?.large,
                mubi_id: data.id, mubi_slug: slug, countries,
            },
            credits: (data.directors || []).map(d => ({
                name: d.name, role: 'director',
                mubi_slug: d.canonical_url?.split('/').pop()
            })),
        };
    }
}

// ─── Database Sync ────────────────────

async function upsertPerson(credit) {
    if (!credit.name) return null;
    if (credit.mubi_slug) {
        const { data } = await supabase.from('people').select('id').eq('mubi_slug', credit.mubi_slug).maybeSingle();
        if (data) return data.id;
    }
    const { data: byName } = await supabase.from('people').select('id').ilike('name', credit.name).maybeSingle();
    if (byName) {
        if (credit.mubi_slug) await supabase.from('people').update({ mubi_slug: credit.mubi_slug }).eq('id', byName.id);
        return byName.id;
    }
    const { data: newPerson, error } = await supabase.from('people').insert({ name: credit.name, mubi_slug: credit.mubi_slug }).select('id').single();
    if (error) return null;
    return newPerson.id;
}

async function syncFilm({ metadata, credits }) {
    const filmCountries = (metadata.countries || []).map(c => c.trim());
    const isAfrican = filmCountries.some(c => AFRICAN_COUNTRIES.includes(c));

    if (!isAfrican) {
        console.log(`    ⏭️  Non-African: ${metadata.title} (${filmCountries.join(', ') || 'Unknown'})`);
        return;
    }

    const { data: existing } = await supabase.from('films').select('id')
        .or(`mubi_id.eq.${metadata.mubi_id},mubi_slug.eq.${metadata.mubi_slug}`).maybeSingle();

    const filmPayload = {
        title: metadata.title, year: metadata.year,
        synopsis: metadata.synopsis, runtime_minutes: metadata.runtime_minutes,
        poster_url: metadata.poster_url, backdrop_url: metadata.backdrop_url,
        mubi_id: metadata.mubi_id, mubi_slug: metadata.mubi_slug,
        status: 'released', is_nollywood: filmCountries.includes('Nigeria'),
        countries: filmCountries,
    };

    let filmId;
    if (existing) {
        filmId = existing.id;
        await supabase.from('films').update(filmPayload).eq('id', filmId);
        console.log(`    🔄 Updated: ${metadata.title}`);
    } else {
        const { data: inserted, error } = await supabase.from('films').insert(filmPayload).select('id').single();
        if (error) { console.error(`    ❌ Insert error: ${error.message}`); return; }
        filmId = inserted.id;
        console.log(`    🎬 Inserted: ${metadata.title} (${metadata.year}) [${filmCountries.join(', ')}]`);
    }

    // Sync genres
    for (const genreName of (metadata.genres || [])) {
        const { data: genre } = await supabase.from('genres').select('id').ilike('name', genreName).maybeSingle();
        if (genre) {
            await supabase.from('film_genres').upsert({ film_id: filmId, genre_id: genre.id }, { onConflict: 'film_id,genre_id' });
        }
    }

    // Sync credits
    for (const credit of credits) {
        const personId = await upsertPerson(credit);
        if (personId) {
            await supabase.from('credits').upsert({ film_id: filmId, person_id: personId, role: credit.role, billing_order: 0 }, { onConflict: 'film_id,person_id,role' });
        }
    }

    // Sync relational countries
    for (const countryName of filmCountries) {
        if (AFRICAN_COUNTRIES.includes(countryName)) {
            const { data: countryRow } = await supabase.from('countries').select('id').eq('name', countryName).maybeSingle();
            if (countryRow) {
                await supabase.from('film_countries').upsert({ film_id: filmId, country_id: countryRow.id }, { onConflict: 'film_id,country_id' });
            }
        }
    }
}

// ─── Main ───────────────────────────────

async function main() {
    const args = process.argv.slice(2);
    const limit = parseInt(args[0]) || 0;
    console.log(`🚀 Starting Mubi Sync (Limit: ${limit || 'Infinite'})...\n`);

    const state = loadState();

    // ── PHASE 1: Discover all films by country ──
    console.log('═══ PHASE 1: DISCOVERY ═══');
    for (const country of AFRICAN_COUNTRIES) {
        await discoverCountry(country, state);
    }
    saveState(state);
    console.log(`\n✅ Discovery done. ${state.pending_slugs.length} films queued.\n`);

    // ── PHASE 2: Sync all discovered films ──
    console.log('═══ PHASE 2: SYNC ═══');
    let synced = 0;

    while (state.pending_slugs.length > 0) {
        const slug = state.pending_slugs.shift();
        if (state.processed_slugs.has(slug)) continue;

        console.log(`\n[${synced + 1}] ${slug} (${state.pending_slugs.length} remaining)`);
        try {
            const data = await extractFilmDetail(slug);
            if (data) await syncFilm(data);
            state.processed_slugs.add(slug);
            synced++;
            if (synced % 10 === 0) saveState(state);
        } catch (err) {
            console.error(`  ❌ Error: ${err.message}`);
            if (!err.message.includes('404')) state.pending_slugs.push(slug);
            saveState(state);
            await sleep(10000);
        }

        await sleep(SYNC_DELAY_MS + Math.random() * 1000);
        if (limit > 0 && synced >= limit) break;
    }

    saveState(state);
    console.log(`\n🎉 Done! Synced ${synced} films this run.`);
}

main().catch(console.error);
