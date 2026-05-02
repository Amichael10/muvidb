const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
const { chromium } = require('playwright');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env or .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAfrolandTV() {
  console.log("Launching Playwright to intercept AfrolandTV API...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  let allFilms = [];
  let capturedIds = new Set();
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('getreferencedobjects')) {
      try {
        const json = await response.json();
        if (json.objects && json.objects.length > 0) {
           for (const obj of json.objects) {
             if (obj.type === 'video' && !capturedIds.has(obj.id)) {
               capturedIds.add(obj.id);
               allFilms.push(obj);
             }
           }
        }
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://www.afrolandtv.com/?section=moviessection', { waitUntil: 'networkidle' });
  
  // Try scrolling to load more content
  console.log("Scrolling to load more...");
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
    await page.waitForTimeout(2000);
  }
  
  await browser.close();
  
  console.log(`Intercepted ${allFilms.length} unique films from API.`);
  
  if (allFilms.length === 0) return;
  
  const filmsToUpsert = [];
  for (const obj of allFilms) {
    const countries = obj.origin_country ? obj.origin_country.map(c => c.name) : [];
    
    const year = obj.year ? parseInt(obj.year, 10) : null;
    const runtime_minutes = obj.duration ? Math.floor(parseInt(obj.duration, 10) / 60) : null;
    
    const poster = obj.vertical_standard_thumbnail_url || obj.thumbnail_url || obj.screencap_widescreen;
    const backdrop = obj.widescreen_thumbnail_url || obj.screencap_widescreen;
    
    filmsToUpsert.push({
      title: obj.name,
      synopsis: obj.long_description || obj.short_description || '',
      year: year,
      runtime_minutes: runtime_minutes,
      poster_url: poster,
      backdrop_url: backdrop,
      source: 'afrolandtv',
      source_video_id: obj.id,
      youtube_watch_url: obj.share_url || ('https://www.afrolandtv.com' + obj.url),
      countries: countries,
      needs_review: false 
    });
  }
  
  let inserted = 0;
  let errors = 0;
  
  for (const film of filmsToUpsert) {
    const { data: existing } = await supabase
      .from('films')
      .select('id')
      .eq('source', 'afrolandtv')
      .eq('source_video_id', film.source_video_id)
      .single();
      
    if (!existing) {
      const { error } = await supabase.from('films').insert([film]);
      if (error) {
        console.error(`Error inserting ${film.title}:`, error.message);
        errors++;
      } else {
        inserted++;
      }
    } else {
      // skip existing
    }
  }
  
  console.log(`\nDONE! Inserted ${inserted} new films from AfrolandTV. Errors: ${errors}.`);
}

syncAfrolandTV().catch(console.error);
