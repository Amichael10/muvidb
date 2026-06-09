import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { generateAIContent } from '../api/_lib/ai_service.js';

// Load stealth plugin
const stealthPlugin = stealth();
chromium.use(stealthPlugin);

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const STATE_FILE = 'mubi_playwright_state.json';
const COUNTRY = process.env.COUNTRY || 'Nigeria';
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '100');

const ROLE_MAP = {
  'Cast': 'actor',
  'Director': 'director',
  'Producer': 'producer',
  'Executive Producer': 'producer',
  'Screenplay': 'writer',
  'Cinematography': 'crew',
  'Music': 'crew',
  'Editing': 'crew',
  'Art Direction': 'crew',
  'Costume Design': 'crew'
};

const COUNTRY_CODES = {
  'Nigeria': 'NG', 'Algeria': 'DZ', 'Angola': 'AO', 'Benin': 'BJ', 'Botswana': 'BW',
  'Burkina Faso': 'BF', 'Burundi': 'BI', 'Cabo Verde': 'CV', 'Cameroon': 'CM',
  'Central African Republic': 'CF', 'Chad': 'TD', 'Comoros': 'KM', 'Congo': 'CG',
  'Congo (DRC)': 'CD', 'Djibouti': 'DJ', 'Egypt': 'EG', 'Equatorial Guinea': 'GQ',
  'Eritrea': 'ER', 'Eswatini': 'SZ', 'Ethiopia': 'ET', 'Gabon': 'GA', 'Gambia': 'GM',
  'Ghana': 'GH', 'Guinea': 'GN', 'Guinea-Bissau': 'GW', 'Ivory Coast': 'CI',
  'Kenya': 'KE', 'Lesotho': 'LS', 'Liberia': 'LR', 'Libya': 'LY', 'Madagascar': 'MG',
  'Malawi': 'MW', 'Mali': 'ML', 'Mauritania': 'MR', 'Mauritius': 'MU', 'Morocco': 'MA',
  'Mozambique': 'MZ', 'Namibia': 'NA', 'Niger': 'NE', 'Rwanda': 'RW',
  'Sao Tome and Principe': 'ST', 'Senegal': 'SN', 'Seychelles': 'SC', 'Sierra Leone': 'SL',
  'Somalia': 'SO', 'South Africa': 'ZA', 'South Sudan': 'SS', 'Sudan': 'SD',
  'Tanzania': 'TZ', 'Togo': 'TG', 'Tunisia': 'TN', 'Uganda': 'UG', 'Zambia': 'ZM', 'Zimbabwe': 'ZW'
};

const AFRICAN_COUNTRIES = Object.keys(COUNTRY_CODES);

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      console.warn('⚠️ State file corrupted, resetting.');
    }
  }
  return {
    current_country: COUNTRY,
    current_page: 1,
    processed_slugs: [],
    countries_done: []
  };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function upsertPerson(name, mubiSlug) {
  if (!name) return null;
  
  const { data: existing } = await supabase
    .from('people')
    .select('id, mubi_slug, source')
    .ilike('name', name)
    .maybeSingle();

  if (existing) {
    // If they exist but don't have a Mubi slug or source is 'netflix/prime', update them
    if (!existing.mubi_slug || existing.source !== 'mubi') {
      await supabase
        .from('people')
        .update({ mubi_slug: mubiSlug, source: 'mubi' })
        .eq('id', existing.id);
    }
    return existing.id;
  }
  
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ name, mubi_slug: mubiSlug, source: 'mubi', nationality: 'Nigerian' })
    .select('id')
    .single();
    
  if (error) {
    console.error(`  ⚠️ Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
}

/**
 * AI Verification to confirm Nollywood/African origin
 */
async function verifyNollywoodAI(movie: any) {
  const prompt = `Identify if the following film is a Nollywood (Nigerian) or African production. 
Title: ${movie.title}
Synopsis: ${movie.synopsis}
Cast: ${movie.cast?.join(', ')}

Return ONLY a JSON object: {"isAfrican": true, "confidence": 0.9, "reason": "brief reason"}`;

  try {
    const { text } = await generateAIContent(prompt);
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleanedText);
    return result.isAfrican && result.confidence > 0.6;
  } catch (e) {
    console.warn(`  ⚠️ AI Verification failed for ${movie.title}, defaulting to country metadata.`);
    return null; 
  }
}

async function syncFilm(filmData, credits) {
  const { mubi_id, title, year, slug } = filmData;
  
  let { data: existing } = await supabase
    .from('films')
    .select('id')
    .eq('mubi_id', String(mubi_id))
    .maybeSingle();
    
  if (!existing && slug) {
    const { data: bySlug } = await supabase
      .from('films')
      .select('id')
      .eq('mubi_slug', slug)
      .maybeSingle();
    existing = bySlug;
  }
  
  if (!existing) {
    const { data: byTitle } = await supabase
      .from('films')
      .select('id')
      .eq('title', title)
      .eq('year', year)
      .maybeSingle();
    existing = byTitle;
  }
    
  const payload = {
    mubi_id: String(filmData.mubi_id),
    mubi_slug: filmData.mubi_slug,
    title: filmData.title,
    year: filmData.year,
    synopsis: filmData.synopsis,
    runtime_minutes: filmData.runtime_minutes,
    poster_url: filmData.poster_url,
    backdrop_url: filmData.backdrop_url,
    is_nollywood: filmData.is_nollywood,
    countries: filmData.countries || [],
    source: 'mubi',
    status: 'released',
    needs_review: true
  };
  
  let filmId;
  if (existing) {
    filmId = existing.id;
    await supabase.from('films').update(payload).eq('id', filmId);
    console.log(`  🔄 Updated: ${title} (${year})`);
  } else {
    const { data: inserted, error } = await supabase
      .from('films')
      .insert(payload)
      .select('id')
      .single();
    if (error) {
      console.error(`  ❌ Error inserting ${title}:`, error.message);
      return;
    }
    if (!inserted) {
      console.error(`  ❌ Insert failed for ${title}: No data returned`);
      return;
    }
    filmId = inserted.id;
    console.log(`  ✅ Inserted: ${title} (${year})`);
  }
  
  if (filmData.countries?.length > 0) {
    for (const cName of filmData.countries) {
      const { data: countryRow } = await supabase
        .from('countries')
        .select('id')
        .ilike('name', cName)
        .maybeSingle();
      if (countryRow) {
        await supabase.from('film_countries').upsert({
          film_id: filmId,
          country_id: countryRow.id
        }, { onConflict: 'film_id,country_id' });
      }
    }
  }
  
  if (filmData.genres?.length > 0) {
    for (const gName of filmData.genres) {
      let genreId;
      const { data: genreRow } = await supabase
        .from('genres')
        .select('id')
        .ilike('name', gName)
        .maybeSingle();
        
      if (genreRow) {
        genreId = genreRow.id;
      } else {
        const { data: newGenre } = await supabase
          .from('genres')
          .insert({ name: gName, slug: gName.toLowerCase().replace(/[^a-z0-9]+/g, '-') })
          .select('id')
          .single();
        if (newGenre) genreId = newGenre.id;
      }
      
      if (genreId) {
        await supabase.from('film_genres').upsert({
          film_id: filmId,
          genre_id: genreId
        }, { onConflict: 'film_id,genre_id' });
      }
    }
  }

  for (const c of credits) {
    const personId = await upsertPerson(c.name, c.mubi_slug);
    if (personId) {
      await supabase.from('credits').upsert({
        film_id: filmId,
        person_id: personId,
        role: c.role,
        original_role: c.original_role,
        character_name: c.character_name
      }, { onConflict: 'film_id,person_id,role,character_name' });
    }
  }
}

async function scrapeFilmDetails(context, mubiId, currentCountry) {
  const apiUrl = `https://api.mubi.com/v3/films/${mubiId}`;
  
  try {
    const response = await context.request.get(apiUrl, {
      headers: {
        'Client-Country': getCountryCode(currentCountry),
        'client': 'web',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok()) {
      console.warn(`  ⚠️ Failed to fetch metadata for ${mubiId}: ${response.status()}`);
      return null;
    }

    const film = await response.json();
    
    if (!film || typeof film !== 'object') {
      console.warn(`  ⚠️ Missing or invalid film metadata for ${mubiId}`);
      return null;
    }
    
    const credits = [];
    if (film.cast && Array.isArray(film.cast)) {
      film.cast.forEach(c => {
        if (c?.name) {
          const mubiRoles = c.credits ? c.credits.split(', ') : ['Unknown'];
          mubiRoles.forEach(mubiRole => {
            let internalRole = 'crew';
            if (mubiRole === 'Cast' || c.character_name) internalRole = 'actor';
            else if (mubiRole === 'Director') internalRole = 'director';
            else if (mubiRole === 'Producer' || mubiRole === 'Executive Producer') internalRole = 'producer';
            else if (mubiRole === 'Screenplay' || mubiRole === 'Writer' || mubiRole === 'Story') internalRole = 'writer';
            
            credits.push({
              name: c.name,
              role: internalRole,
              original_role: mubiRole,
              character_name: c.character_name || null,
              mubi_slug: c.slug
            });
          });
        }
      });
    }

    const historicCountries = Array.isArray(film.historic_countries) ? film.historic_countries : [];
    const countries = historicCountries.filter(c => AFRICAN_COUNTRIES.includes(c));

    // 1. Strict Title Blocklist
    const isExcluded = /007|James Bond|Mission Impossible|Marvel|Avengers|Hollywood|Fast & Furious/i.test(film.title);
    if (isExcluded) {
      console.log(`  ⏩ Skipping non-Nollywood blockbuster: ${film.title}`);
      return null;
    }

    if (countries.length === 0) {
      console.warn(`  ⚠️ Skipping non-African or unverified film: ${film.title} (${historicCountries.join(', ')})`);
      return null;
    }

    // 2. AI Verification Layer
    const movieData = {
      title: film.title,
      synopsis: film.short_synopsis || film.default_editorial || '',
      cast: credits.filter(c => c.role === 'actor').map(c => c.name)
    };

    const isConfirmedAfrican = await verifyNollywoodAI(movieData);
    
    // If AI explicitly says it's NOT African, skip it
    if (isConfirmedAfrican === false) {
      console.log(`  🚫 AI confirmed ${film.title} is NOT African. Skipping.`);
      return null;
    }
    
    return {
      metadata: {
        mubi_id: String(film.id),
        mubi_slug: film.slug,
        title: film.title || 'Unknown Title',
        year: film.year || null,
        synopsis: film.short_synopsis || film.default_editorial || '',
        runtime_minutes: film.duration || 0,
        poster_url: film.still_url || (film.stills ? film.stills.retina : null),
        backdrop_url: (film.stills ? film.stills.retina : null),
        genres: Array.isArray(film.genres) ? film.genres : [],
        countries: countries,
        is_nollywood: countries.includes('Nigeria')
      },
      credits
    };
  } catch (error) {
    console.error(`  ❌ Failed ${mubiId}: ${error.message}`);
    return null;
  }
}

async function main() {
  const state = loadState();
  
  const proxyConfig = {
    server: `http://${process.env.SMARTPROXY_HOST || 'proxy.smartproxy.net'}:${process.env.SMARTPROXY_PORT || '3120'}`,
    username: process.env.SMARTPROXY_USER,
    password: process.env.SMARTPROXY_PASS
  };
  
  console.log(`🚀 Launching Playwright with proxy: ${proxyConfig.server}`);
  const browser = await chromium.launch({ 
    headless: true,
    proxy: proxyConfig
  });
  const context = await browser.newContext();
  
  try {
    let country = state.current_country;
    let finishedAll = false;

    while (!finishedAll) {
      console.log(`\n🌍 Processing ${country} (Starting from page ${state.current_page})`);
      let pagesRemaining = true;

      for (let p = state.current_page; p <= MAX_PAGES; p++) {
        console.log(`\n📄 Page ${p}/${MAX_PAGES} for ${country}`);
        const browseUrl = `https://api.mubi.com/v4/browse/films?country=${encodeURIComponent(country)}&all_films=true&sort=popularity_quality_score&page=${p}&per_page=24`;
        
        const response = await context.request.get(browseUrl, {
          headers: {
            'Client-Country': getCountryCode(country),
            'client': 'web',
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (!response.ok()) {
           console.error(`  ⚠️ API Error ${response.status()}`);
           pagesRemaining = false;
           break;
        }
        
        const nextData = await response.json();
        const films = nextData.films || [];
        
        if (films.length === 0) {
          console.log(`  🏁 No more films found for ${country}.`);
          pagesRemaining = false;
          break;
        }
        
        for (const f of films) {
          if (state.processed_slugs.includes(f.slug)) continue;

          let dbExisting = null;
          
          // 1. Try slug
          const { data: bySlug } = await supabase
            .from('films')
            .select('id')
            .eq('mubi_slug', f.slug)
            .maybeSingle();
          dbExisting = bySlug;

          // 2. Try title/year if slug not found
          if (!dbExisting) {
            const { data: byTitle } = await supabase
              .from('films')
              .select('id')
              .eq('title', f.title)
              .eq('year', f.year)
              .maybeSingle();
            dbExisting = byTitle;
          }

          if (dbExisting) {
            console.log(`  🔗 Linking existing (upgrading metadata): ${f.title} (${f.year})`);
            try {
              const result = await Promise.race([
                scrapeFilmDetails(context, f.id, country),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 120000))
              ]);
              
              if (result) {
                // This will now update the existing film with Mubi metadata and source: 'mubi'
                await syncFilm(result.metadata, result.credits);
                state.processed_slugs.push(f.slug);
                saveState(state);
              }
            } catch (err) {
              console.error(`  ❌ Failed to upgrade ${f.slug}: ${err.message}`);
            }
            continue;
          }
          
          try {
            console.log(`  🎬 Processing: ${f.title} (${f.slug})`);
            const result = await Promise.race([
              scrapeFilmDetails(context, f.id, country),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 120000))
            ]);
            
            if (result) {
              await syncFilm(result.metadata, result.credits);
              state.processed_slugs.push(f.slug);
              saveState(state);
            }
            await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
          } catch (err) {
            console.error(`  ❌ Failed ${f.slug}: ${err.message}`);
          }
        }
        
        state.current_page = p + 1;
        saveState(state);
      }
      
      // ROTATION LOGIC
      if (!pagesRemaining || state.current_page > MAX_PAGES) {
        console.log(`🎉 Finished ${country}!`);
        if (!state.countries_done) state.countries_done = [];
        if (!state.countries_done.includes(country)) state.countries_done.push(country);
        
        // Find next country
        const nextCountry = AFRICAN_COUNTRIES.find(c => !state.countries_done.includes(c));
        if (nextCountry) {
           console.log(`🔄 Rotating to next country: ${nextCountry}`);
           state.current_country = nextCountry;
           state.current_page = 1;
           country = nextCountry;
           saveState(state);
           // Continue while loop
        } else {
           console.log(`🎊 All African countries have been processed!`);
           console.log(`🔄 Resetting cycle to begin again on the next run.`);
           state.countries_done = [];
           state.current_country = AFRICAN_COUNTRIES[0];
           state.current_page = 1;
           saveState(state);
           finishedAll = true;
           break;
        }
      } else {
        // If we finished the MAX_PAGES loop but pages were still remaining, stop for now
        break;
      }
    }
    
  } finally {
    await browser.close();
  }
}

function getCountryCode(name) {
  return COUNTRY_CODES[name] || 'NG';
}

main().catch(console.error);
