import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function upsertPerson(name: string, bio: string | null = null, profileUrl: string | null = null) {
  if (!name) return null;
  const { data: existing } = await supabase.from('people').select('id').ilike('name', name).maybeSingle();
  if (existing) {
    // Optionally update bio and profile image if they are missing
    await supabase.from('people').update({ 
      ...(bio && { biography: bio }),
      ...(profileUrl && { profile_image_url: profileUrl })
    }).eq('id', existing.id);
    return existing.id;
  }

  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ 
      name, 
      source: 'imdb', 
      nationality: 'Nigerian',
      biography: bio,
      profile_image_url: profileUrl
    })
    .select('id')
    .single();
    
  if (error) {
    console.error(`  ⚠️ Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function scrapeImdbActor(actorName: string) {
  console.log(`🎬 Searching IMDb for actor: ${actorName}`);
  
  const launchOptions: any = { headless: false };
  let proxyUser = process.env.SMARTPROXY_USER;
  const proxyPass = process.env.SMARTPROXY_PASS;
  const proxyServer = process.env.SMARTPROXY_HOST && process.env.SMARTPROXY_PORT 
    ? `${process.env.SMARTPROXY_HOST}:${process.env.SMARTPROXY_PORT}` 
    : null;

  if (proxyServer && proxyUser && proxyPass) {
    console.log(`🛡️ Configuring browser to use SmartProxy: ${proxyServer}`);
    launchOptions.proxy = {
      server: proxyServer,
      username: proxyUser,
      password: proxyPass
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    // 1. Search for the actor
    const searchUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(actorName)}&s=nm`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    // Check if search results exist
    const firstResult = await page.waitForSelector('.ipc-metadata-list-summary-item a.ipc-metadata-list-summary-item__t', { timeout: 10000 }).catch(() => null);
    
    if (!firstResult) {
      console.log(`❌ Could not find actor "${actorName}" on IMDb.`);
      await browser.close();
      return;
    }

    const actorUrl = await firstResult.getAttribute('href');
    if (!actorUrl) return;

    // 2. Go to Actor Profile
    console.log(`👤 Navigating to actor profile...`);
    await page.goto(`https://www.imdb.com${actorUrl}`, { waitUntil: 'domcontentloaded' });

    // 3. Extract Bio and Image
    const nameStr = await page.locator('h1.hero__primary-text').textContent().catch(() => actorName);
    const bioStr = await page.locator('.ipc-html-content-inner-div').first().textContent().catch(() => null);
    const imgStr = await page.locator('.ipc-image').first().getAttribute('src').catch(() => null);

    console.log(`✅ Extracted Profile: ${nameStr}`);
    
    const personId = await upsertPerson(nameStr || actorName, bioStr, imgStr);
    
    // 4. Extract Filmography
    console.log('🎞️ Extracting filmography...');
    // In the new IMDb layout, credits are usually in an accordion or list
    const credits = await page.locator('.ipc-metadata-list-summary-item__t').all();
    
    for (const credit of credits.slice(0, 15)) { // Limit to 15 recent for now
      const title = await credit.textContent();
      const href = await credit.getAttribute('href');
      
      if (title && href) {
        console.log(`  🎥 Found credit: ${title}`);
        
        // Check if movie already exists
        const { data: existingMovie } = await supabase.from('films').select('id').ilike('title', title).maybeSingle();
        
        let movieId = existingMovie?.id;
        
        if (!existingMovie) {
          // Add basic movie info
          const { data: newMovie } = await supabase.from('films').insert({
            title: title,
            source: 'imdb'
          }).select('id').single();
          movieId = newMovie?.id;
        }

        if (movieId && personId) {
          // Link cast
          await supabase.from('film_cast').upsert({
            film_id: movieId,
            person_id: personId,
            role_type: 'actor'
          }, { onConflict: 'film_id, person_id' }).catch(() => null); // Catch unique constraint errors softly
        }
      }
    }
    
    console.log('🎉 Done scraping IMDb!');

  } catch (err) {
    console.error('❌ Error scraping IMDb:', err);
  } finally {
    await browser.close();
  }
}

const args = process.argv.slice(2);
const actorArgIndex = args.indexOf('--actor');

if (actorArgIndex !== -1 && args[actorArgIndex + 1]) {
  scrapeImdbActor(args[actorArgIndex + 1]);
} else {
  console.log('Usage: npx tsx scripts/imdb_scraper.ts --actor "Actor Name"');
}
