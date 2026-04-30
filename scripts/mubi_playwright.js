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
const MAX_PAGES = parseInt(process.env.MAX_PAGES || '17');

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

const AFRICAN_COUNTRIES = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon',
  'Central African Republic', 'Chad', 'Comoros', 'Congo', 'Congo (DRC)', 'Djibouti', 'Egypt',
  'Equatorial Guinea', 'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea',
  'Guinea-Bissau', 'Ivory Coast', 'Kenya', 'Lesotho', 'Liberia', 'Libya', 'Madagascar', 'Malawi',
  'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
  'Rwanda', 'Sao Tome and Principe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia',
  'South Africa', 'South Sudan', 'Sudan', 'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe'
];

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
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
  
  // Try to find person by name (case-insensitive)
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .ilike('name', name)
    .maybeSingle();
    
  if (existing) return existing.id;
  
  // Create new person
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
  
  // 1. Upsert Film
  const { data: existing } = await supabase
    .from('films')
    .select('id')
    .or(`mubi_id.eq.${mubi_id},and(title.eq."${title}",year.eq.${year})`)
    .maybeSingle();
    
  const payload = {
    ...filmData,
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
    filmId = inserted.id;
    console.log(`  ✅ Inserted: ${title} (${year})`);
  }
  
  // 2. Link Countries
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
  
  // 3. Link Genres
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
  
  // 4. Credits
  for (const credit of credits) {
    const personId = await upsertPerson(credit.name, credit.mubi_slug);
    if (personId) {
      await supabase.from('credits').upsert({
        film_id: filmId,
        person_id: personId,
        role: ROLE_MAP[credit.original_role] || credit.role || 'crew',
        character_name: credit.character_name || null,
        billing_order: 0
      }, { onConflict: 'film_id,person_id,role' });
    }
  }
}

async function scrapeFilmDetails(browser, slug) {
  const page = await browser.newPage();
  try {
    const url = `https://mubi.com/en/films/${slug}`;
    console.log(`  📡 Visiting: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000); // Small delay for hydration
    
    const nextDataStr = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent);
    if (!nextDataStr) throw new Error('No __NEXT_DATA__ found');
    
    const nextData = JSON.parse(nextDataStr);
    const film = nextData.props.pageProps.initFilm;
    
    // Visit cast page
    const castUrl = `${url}/cast`;
    await page.goto(castUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    const castDataStr = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent);
    const credits = [];
    
    if (castDataStr) {
      const castData = JSON.parse(castDataStr).props.pageProps;
      if (castData.cast) {
        castData.cast.forEach(c => credits.push({
          name: c.name,
          role: 'actor',
          character_name: c.role,
          mubi_slug: c.slug
        }));
      }
      if (castData.crew) {
        castData.crew.forEach(c => credits.push({
          name: c.name,
          role: 'crew',
          original_role: c.job,
          mubi_slug: c.slug
        }));
      }
    }
    
    const countries = (film.historic_countries || []).filter(c => AFRICAN_COUNTRIES.includes(c));
    
    return {
      metadata: {
        mubi_id: String(film.id),
        mubi_slug: slug,
        title: film.title,
        year: film.year,
        synopsis: film.short_synopsis || film.default_editorial || '',
        runtime_minutes: film.duration,
        poster_url: film.still_url || film.stills?.retina,
        backdrop_url: film.stills?.retina,
        genres: film.genres || [],
        countries: countries,
        is_nollywood: countries.includes('Nigeria')
      },
      credits
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const state = loadState();
  const country = state.current_country;
  
  console.log(`🚀 Starting Playwright Scraper for ${country} from page ${state.current_page}`);
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  try {
    for (let p = state.current_page; p <= MAX_PAGES; p++) {
      console.log(`\n📄 Page ${p}/${MAX_PAGES}`);
      // USE FAST API FOR DISCOVERY
      const browseUrl = `https://api.mubi.com/v4/browse/films?historic_countries[]=${getCountryCode(country)}&page=${p}&per_page=24`;
      console.log(`  📡 Fetching API: ${browseUrl}`);
      
      const response = await context.request.get(browseUrl, {
        headers: {
          'Client-Country': 'NG',
          'client': 'web',
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok()) {
         console.error(`  ⚠️ API Error ${response.status()}: ${await response.text()}`);
         break;
      }
      
      const nextData = await response.json();
      const films = nextData.films || [];
      
      if (films.length === 0) {
        console.log('  Empty film list from API. Finishing country.');
        break;
      }
      
      console.log(`  Found ${films.length} films.`);
      
      for (const f of films) {
        if (state.processed_slugs.includes(f.slug)) {
          console.log(`  ⏭️ Already processed: ${f.slug}`);
          continue;
        }
        
        try {
          const { metadata, credits } = await scrapeFilmDetails(context, f.slug);
          await syncFilm(metadata, credits);
          state.processed_slugs.push(f.slug);
          saveState(state);
          
          // Random delay to avoid detection
          await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
        } catch (err) {
          console.error(`  ❌ Failed to process ${f.slug}:`, err.message);
        }
      }
      
      state.current_page = p + 1;
      saveState(state);
    }
    
    // Check if we should rotate to another country
    if (state.current_page > MAX_PAGES) {
      console.log(`\n🎉 Finished ${country}!`);
      state.countries_done.push(country);
      const nextCountry = AFRICAN_COUNTRIES.find(c => !state.countries_done.includes(c));
      if (nextCountry) {
        console.log(`🌍 Next up: ${nextCountry}`);
        state.current_country = nextCountry;
        state.current_page = 1;
        state.processed_slugs = []; // Reset or keep? Let's reset for the new country context
      } else {
        console.log('🏁 All African countries processed!');
      }
      saveState(state);
    }
    
  } finally {
    await browser.close();
  }
}

function getCountryCode(name) {
  const codes = {
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
  return codes[name] || 'NG';
}

main().catch(console.error);
