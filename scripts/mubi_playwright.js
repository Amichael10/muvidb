import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

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
    .select('id')
    .ilike('name', name)
    .maybeSingle();
    
  if (existing) return existing.id;
  
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ name, mubi_slug: mubiSlug, source: 'mubi' })
    .select('id')
    .single();
    
  if (error) {
    console.error(`  ⚠️ Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
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
    countries: filmData.countries?.join(', '),
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
      const { data: genreRow } = await supabase
        .from('genres')
        .select('id')
        .ilike('name', gName)
        .maybeSingle();
      if (genreRow) {
        await supabase.from('film_genres').upsert({
          film_id: filmId,
          genre_id: genreRow.id
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
        role: ROLE_MAP[c.role] || 'crew',
        original_role: c.original_role || c.role,
        character_name: c.character_name
      }, { onConflict: 'film_id,person_id,role,character_name' });
    }
  }
}

async function scrapeFilmDetails(context, slug, currentCountry) {
  const filmUrl = `https://mubi.com/films/${slug}`;
  const castUrl = `https://mubi.com/films/${slug}/cast`;
  
  const page = await context.newPage();
  try {
    await page.goto(filmUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const dataStr = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent);
    if (!dataStr) return null;
    
    const pageProps = JSON.parse(dataStr).props?.pageProps;
    const film = pageProps?.film;
    
    if (!film || typeof film !== 'object') {
      console.warn(`  ⚠️ Missing or invalid film metadata for ${slug}`);
      return null;
    }
    
    await page.goto(castUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const castDataStr = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent);
    const credits = [];
    
    if (castDataStr) {
      try {
        const castData = JSON.parse(castDataStr).props?.pageProps;
        if (castData?.cast && Array.isArray(castData.cast)) {
          castData.cast.forEach(c => {
            if (c?.name) credits.push({
              name: c.name,
              role: 'Cast',
              character_name: c.role,
              mubi_slug: c.slug
            });
          });
        }
        if (castData?.crew && Array.isArray(castData.crew)) {
          castData.crew.forEach(c => {
            if (c?.name) credits.push({
              name: c.name,
              role: 'Crew',
              original_role: c.job,
              mubi_slug: c.slug
            });
          });
        }
      } catch (e) {
        console.warn(`  ⚠️ Could not parse cast data for ${slug}`);
      }
    }
    
    const historicCountries = Array.isArray(film.historic_countries) ? film.historic_countries : [];
    const countries = historicCountries.filter(c => AFRICAN_COUNTRIES.includes(c));
    
    return {
      metadata: {
        mubi_id: String(film.id),
        mubi_slug: slug,
        title: film.title || 'Unknown Title',
        year: film.year || null,
        synopsis: film.short_synopsis || film.default_editorial || '',
        runtime_minutes: film.duration || 0,
        poster_url: film.still_url || (film.stills ? film.stills.retina : null),
        backdrop_url: (film.stills ? film.stills.retina : null),
        genres: Array.isArray(film.genres) ? film.genres : [],
        countries: countries.length > 0 ? countries : [currentCountry],
        is_nollywood: countries.includes('Nigeria') || currentCountry === 'Nigeria'
      },
      credits
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const state = loadState();
  
  const browser = await chromium.launch({ headless: true });
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
                scrapeFilmDetails(context, f.slug, country),
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
              scrapeFilmDetails(context, f.slug, country),
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
