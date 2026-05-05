import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';

// Load stealth plugin
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

const PRIME_SEARCH_URL = 'https://www.primevideo.com/search/ref=atv_nb_sug?ie=UTF8&phrase=nollywood';
const LOGIN_URL = 'https://www.amazon.com/ap/signin'; // Amazon login often used for Prime

async function login(page) {
  const email = process.env.PRIME_EMAIL;
  const password = process.env.PRIME_PASSWORD;

  if (!email || !password) {
    console.log('⚠️ PRIME_EMAIL or PRIME_PASSWORD not set. Attempting as guest...');
    return;
  }

  console.log('🔐 Attempting to login to Amazon/Prime...');
  try {
    await page.goto('https://www.primevideo.com/', { waitUntil: 'networkidle' });
    
    // Check if already logged in
    const signInButton = await page.$('a[href*="/signin"], .pv-nav-sign-in');
    if (!signInButton) {
      console.log('✅ Already logged in (presumably)');
      return;
    }

    await page.goto('https://www.amazon.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.primevideo.com%2Fauth%2Freturn%2F&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=amzn_prime_video_desktop_us&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0', { waitUntil: 'networkidle' });

    await page.fill('#ap_email', email);
    await page.click('#continue');
    await page.fill('#ap_password', password);
    await page.click('#signInSubmit');
    
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    console.log('✅ Login submitted.');
    
    // Handle OTP if it appears (though we can't automate this easily, we can wait a bit)
    if (await page.isVisible('#auth-mfa-otpcode')) {
      console.log('⚠️ OTP required! Please handle this in your browser session or check for manual override.');
      // We'll wait a bit longer just in case the user can approve it
      await page.waitForTimeout(10000);
    }
  } catch (e) {
    console.error('❌ Login failed or timed out:', e.message);
  }
}

function parsePrimeDuration(durationStr: string): number | null {
  if (!durationStr) return null;
  const hMatch = durationStr.match(/(\d+)\s*h/i);
  const mMatch = durationStr.match(/(\d+)\s*min/i);
  let total = 0;
  if (hMatch) total += parseInt(hMatch[1]) * 60;
  if (mMatch) total += parseInt(mMatch[1]);
  return total > 0 ? total : null;
}

async function scrapePrime() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  await login(page);

  console.log(`🚀 Navigating to Prime Search: ${PRIME_SEARCH_URL}`);
  await page.goto(PRIME_SEARCH_URL, { waitUntil: 'networkidle' });

  // Handle cookies banner if it exists
  try {
    const cookieButton = await page.waitForSelector('#sp-cc-accept, #pv-nav-accept-cookies', { timeout: 3000 });
    if (cookieButton) await cookieButton.click();
  } catch (e) {}

  let movieUrls = new Set<string>();

  // 1. Discover URLs via Infinite Scroll
  console.log('📜 Scrolling to load more Nollywood titles...');
  let lastHeight = 0;
  let scrollAttempts = 0;
  const maxScrollAttempts = 15;

  while (scrollAttempts < maxScrollAttempts) {
    const links = await page.evaluate(() => {
      // Selector from browser subagent: .detailLink-zyfcZQ
      // Fallbacks: a[href*="/detail/"], a[href*="/gp/video/detail/"]
      const elements = Array.from(document.querySelectorAll('.detailLink-zyfcZQ, a[href*="/detail/"], a[href*="/gp/video/detail/"]'));
      return elements
        .map(a => (a as HTMLAnchorElement).href.split('?')[0])
        .filter(url => url && !url.includes('javascript:'));
    });
    
    links.forEach(url => movieUrls.add(url));
    console.log(`✅ Total unique links found so far: ${movieUrls.size}`);

    const newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
    
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(2000);
    scrollAttempts++;
  }

  console.log(`📽️ Discovered ${movieUrls.size} unique movie URLs. Starting deep extraction...`);
  
  const allMovies: any[] = [];
  const urlList = Array.from(movieUrls);
  
  for (const url of urlList) {
    console.log(`📄 Fetching details for: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for at least the title to appear
      await page.waitForSelector('h1', { timeout: 8000 }).catch(() => null);

      const details = await page.evaluate(() => {
        const titleEl = document.querySelector('h1[data-testid="title"], h1[data-automation-id="title"], h1, .dv-node-dp-title');
        const synopsisEl = document.querySelector('div[data-testid="synopsis"] span, [data-automation-id="description-text"], .dv-node-dp-synopsis');
        const yearEl = document.querySelector('span[data-testid="release-year"], [data-automation-id="release-year-badge"], .dv-node-dp-release-year');
        const runtimeEl = document.querySelector('span[data-testid="runtime"], [data-automation-id="runtime-badge"]');
        const posterEl = document.querySelector('img[data-testid="poster-image"], img.dv-node-dp-image, img[alt*="Poster" i]');
        const castEls = Array.from(document.querySelectorAll('a[data-testid="cast"], a[href*="role=actor"], .dv-node-dp-cast a'));
        const genresEls = Array.from(document.querySelectorAll('a[data-testid="genre"], a[href*="genre="], .dv-node-dp-genres a'));

        return {
          title: titleEl?.textContent?.trim() || 'Unknown',
          synopsis: synopsisEl?.textContent?.trim() || '',
          year: yearEl?.textContent?.trim() || null,
          runtime: runtimeEl?.textContent?.trim() || null,
          poster_url: (posterEl as HTMLImageElement)?.src || null,
          cast: castEls.map(el => el.textContent?.trim()).filter(Boolean),
          genres: genresEls.map(el => el.textContent?.trim()).filter(Boolean)
        };
      });

      if (details.title !== 'Unknown') {
        allMovies.push({ 
          ...details, 
          url
        });
      }
    } catch (e) {
      console.error(`  ❌ Failed to fetch ${url}: ${e.message}`);
    }
    
    // Random delay to avoid detection
    await page.waitForTimeout(1500 + Math.random() * 2500);
  }

  await browser.close();
  return allMovies;
}

async function upsertPerson(name: string) {
  if (!name) return null;
  
  const { data: existing } = await supabase
    .from('people')
    .select('id')
    .ilike('name', name)
    .maybeSingle();
    
  if (existing) return existing.id;
  
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ name, source: 'prime_video' })
    .select('id')
    .single();
    
  if (error) {
    console.error(`  ⚠️ Error creating person ${name}:`, error.message);
    return null;
  }
  return newPerson.id;
}

async function syncToDatabase(scrapedMovies) {
  let updatedCount = 0;
  let newCount = 0;
  let errorCount = 0;

  for (const movie of scrapedMovies) {
    const cleanedTitle = cleanTitle(movie.title);
    const movieYear = movie.year ? parseInt(movie.year.match(/\d{4}/)?.[0] || '0') : null;
    const runtimeMinutes = parsePrimeDuration(movie.runtime);

    console.log(`🔄 Processing: ${cleanedTitle} (${movieYear || 'N/A'})`);

    try {
      // 1. Try to find existing film by title and year
      let query = supabase.from('films').select('id, title, year, streaming_links, release_type, youtube_watch_url, synopsis, runtime_minutes, poster_url');
      
      if (movieYear) {
        query = query.ilike('title', cleanedTitle).eq('year', movieYear);
      } else {
        query = query.ilike('title', cleanedTitle);
      }

      const { data: results } = await query;
      const existing = results && results.length > 0 ? results[0] : null;

      let filmId;

      if (existing) {
        filmId = existing.id;
        const newStreamingLinks = { 
          ...(existing.streaming_links || {}), 
          prime_video: movie.url 
        };

        const updatePayload: any = {
          streaming_links: newStreamingLinks,
          synopsis: existing.synopsis || movie.synopsis,
          runtime_minutes: existing.runtime_minutes || runtimeMinutes,
          year: existing.year || movieYear,
          poster_url: existing.poster_url || movie.poster_url,
          backdrop_url: (existing as any).backdrop_url || movie.poster_url
        };

        // Update release_type only if no primary link is already available
        // Primary links are YouTube, Kava, or Ironflix. 
        // If it's already set to Netflix, we can leave it as primary.
        const isSuperPrimary = existing.youtube_watch_url || ['kava', 'ironflix'].includes(existing.release_type);
        const isTier2Primary = ['netflix', 'prime_video'].includes(existing.release_type);
        
        if (!isSuperPrimary && !isTier2Primary) {
          updatePayload.release_type = 'prime_video';
        }

        const { error } = await supabase
          .from('films')
          .update(updatePayload)
          .eq('id', existing.id);

        if (error) throw error;
        updatedCount++;
        console.log(`  ✅ Updated existing record.`);
      } else {
        const { data: inserted, error } = await supabase.from('films').insert({
          title: cleanedTitle,
          year: movieYear,
          synopsis: movie.synopsis,
          runtime_minutes: runtimeMinutes,
          poster_url: movie.poster_url,
          backdrop_url: movie.poster_url,
          release_type: 'prime_video',
          streaming_links: { prime_video: movie.url },
          source: 'prime_video',
          status: 'released',
          countries: ['Nigeria'],
          needs_review: true
        }).select('id').single();

        if (error) throw error;
        filmId = inserted.id;
        newCount++;
        console.log(`  ✨ Created new record.`);
      }

      // 2. Sync Genres
      if (movie.genres && movie.genres.length > 0) {
        for (const gName of movie.genres) {
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

      // 3. Sync Cast
      if (movie.cast && movie.cast.length > 0) {
        for (const actorName of movie.cast) {
          const personId = await upsertPerson(actorName);
          if (personId) {
            await supabase.from('credits').upsert({
              film_id: filmId,
              person_id: personId,
              role: 'actor'
            }, { onConflict: 'film_id,person_id,role' });
          }
        }
      }
    } catch (e) {
      console.error(`  ❌ Error processing ${movie.title}:`, e.message);
      errorCount++;
    }
  }

  console.log(`\n📊 Prime Sync Complete:`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - New: ${newCount}`);
  console.log(`   - Errors: ${errorCount}`);
}

async function run() {
  try {
    const movies = await scrapePrime();
    await syncToDatabase(movies);
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
