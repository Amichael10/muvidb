import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
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

const NETFLIX_URL = 'https://www.netflix.com/browse/genre/1138254?bc=34399';
const LOGIN_URL = 'https://www.netflix.com/login';

async function login(page) {
  const email = process.env.NETFLIX_EMAIL;
  const password = process.env.NETFLIX_PASSWORD;

  if (!email || !password) {
    console.log('⚠️ NETFLIX_EMAIL or NETFLIX_PASSWORD not set. Attempting to proceed without login...');
    return;
  }

  console.log('🔐 Attempting to login to Netflix...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

  try {
    await page.waitForSelector('input[name="userLoginId"]', { timeout: 10000 });
    await page.fill('input[name="userLoginId"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 60000 });
    console.log('✅ Login successful (presumably)');
  } catch (e) {
    console.log('ℹ️ Login input not found or navigation failed, might already be logged in.');
  }
}

async function scrapeNetflix() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  await login(page);

  console.log(`🚀 Navigating to: ${NETFLIX_URL}`);
  await page.goto(NETFLIX_URL, { waitUntil: 'networkidle' });

  // Handle profile selection if it appears
  try {
    const profileSelector = 'a[data-uia="profile-link"], .profile-link, .profile-icon';
    console.log('👀 Checking for profile selection screen...');
    await page.waitForSelector(profileSelector, { timeout: 5000 }).catch(() => null);
    
    if (await page.isVisible(profileSelector)) {
      console.log('👤 Selecting a profile...');
      await page.click(profileSelector);
      await page.waitForNavigation({ waitUntil: 'networkidle' }).catch(() => null);
    }
  } catch (e) {
    console.log('ℹ️ No profile selection detected or timed out.');
  }

  console.log('⌛ Waiting for titles to appear...');
  try {
    await page.waitForSelector('.title-card, [data-testid="title-card"]', { timeout: 15000 });
  } catch (e) {
    console.warn('⚠️ Timeout waiting for titles. The page might be empty or selectors changed.');
  }

  console.log('📜 Scrolling to load all Nollywood titles...');
  // Infinite scroll
  let lastHeight = await page.evaluate('document.body.scrollHeight');
  for (let i = 0; i < 10; i++) {
    await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
    await page.waitForTimeout(2000);
    let newHeight = await page.evaluate('document.body.scrollHeight');
    if (newHeight === lastHeight) break;
    lastHeight = newHeight;
  }

  console.log('🕵️ Extracting titles and metadata...');
  const movies = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('.slider-item, .title-card, [data-testid="title-card"]'));
    return items.map(item => {
      const linkEl = item.querySelector('a');
      const imgEl = item.querySelector('img');
      const titleEl = item.querySelector('.fallback-text');
      
      // Try to get title from multiple places
      const title = titleEl?.textContent?.trim() || 
                    linkEl?.getAttribute('aria-label') || 
                    imgEl?.getAttribute('alt') || 
                    'Unknown';
      
      // Netflix watch link looks like /watch/81234567 or /title/81234567
      const href = linkEl?.getAttribute('href') || '';
      const watchIdMatch = href.match(/\/(watch|title)\/(\d+)/);
      const watchId = watchIdMatch ? watchIdMatch[2] : null;
      
      return {
        title,
        netflix_id: watchId,
        url: watchId ? `https://www.netflix.com/title/${watchId}` : null,
        poster_url: imgEl?.src || null
      };
    }).filter(m => m.netflix_id);
  });

  console.log(`🎬 Found ${movies.length} Nollywood titles on Netflix.`);
  
  const detailedMovies: any[] = [];
  for (const movie of movies) {
    if (!movie.url) continue;
    console.log(`📄 Fetching details for: ${movie.title} (${movie.url})`);
    try {
      await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const rawData = await page.evaluate(() => {
        const synopsisEl = document.querySelector('[data-uia="video-description"], .title-info-synopsis, .description-text');
        const yearEl = document.querySelector('[data-uia="year"], [data-uia="video-year"], .year');
        const runtimeEl = document.querySelector('[data-uia="duration"], [data-uia="video-runtime"], .duration');
        const castEls = Array.from(document.querySelectorAll('[data-uia="cast-item"], [data-uia="video-cast"] a, .item-cast'));
        const genreEls = Array.from(document.querySelectorAll('[data-uia="genre-item"], [data-uia="video-genres"] a, .item-genres'));
        const detailTitleEl = document.querySelector('[data-uia="video-title"], .title-title');
        
        return {
          title: detailTitleEl?.textContent?.trim() || null,
          synopsis: synopsisEl?.textContent?.trim() || '',
          year: yearEl?.textContent?.trim() || null,
          runtimeStr: runtimeEl?.textContent?.trim() || null,
          cast: castEls.map(el => el.textContent?.trim().replace(/,$/, '')).filter(Boolean),
          genres: genreEls.map(el => el.textContent?.trim().replace(/,$/, '')).filter(Boolean)
        };
      });

      const parseRuntime = (str: string | null) => {
        if (!str) return null;
        const hMatch = str.match(/(\d+)\s*h/i);
        const mMatch = str.match(/(\d+)\s*m/i);
        let total = 0;
        if (hMatch) total += parseInt(hMatch[1]) * 60;
        if (mMatch) total += parseInt(mMatch[1]);
        return total > 0 ? total : null;
      };

      detailedMovies.push({ 
        ...movie, 
        ...rawData,
        title: movie.title === 'Unknown' ? (rawData.title || movie.title) : movie.title,
        runtime_minutes: parseRuntime(rawData.runtimeStr)
      });
    } catch (e) {
      console.warn(`  ❌ Failed to get details for ${movie.title}: ${e.message}`);
      detailedMovies.push(movie);
    }
    await page.waitForTimeout(1000 + Math.random() * 1000);
  }

  await browser.close();
  return detailedMovies;
}

async function upsertPerson(name: string) {
  if (!name) return null;
  
  // Tier 1: Exact match
  const { data: existing } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', name)
    .maybeSingle();
    
  if (existing) return existing.id;

  // Tier 2: Fuzzy partial match (Stage names or partial matches)
  const { data: partial } = await supabase
    .from('people')
    .select('id, name')
    .ilike('name', `%${name}%`)
    .limit(1)
    .maybeSingle();

  if (partial) {
    console.log(`  🔍 Fuzzy matched "${name}" to existing person "${partial.name}"`);
    return partial.id;
  }
  
  // Tier 3: Create new record
  const { data: newPerson, error } = await supabase
    .from('people')
    .insert({ name, source: 'netflix', nationality: 'Nigerian' })
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
    
    console.log(`🔄 Processing: ${cleanedTitle} (${movieYear || 'N/A'})`);

    try {
      // 1. Try to find existing film
      let query = supabase.from('films').select('id, title, year, streaming_links, release_type, youtube_watch_url, synopsis, poster_url, runtime_minutes');
      
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
          netflix: movie.url 
        };

        const updatePayload: any = {
          streaming_links: newStreamingLinks,
          synopsis: existing.synopsis || movie.synopsis,
          year: existing.year || movieYear,
          runtime_minutes: existing.runtime_minutes || movie.runtime_minutes,
          poster_url: existing.poster_url || movie.poster_url
        };

        // Update release_type only if no primary link is already available
        // Primary links are YouTube, Kava, or Ironflix.
        // If it's already set to Prime, we can leave it as primary.
        const isSuperPrimary = existing.youtube_watch_url || ['kava', 'ironflix'].includes(existing.release_type);
        const isTier2Primary = ['netflix', 'prime_video'].includes(existing.release_type);
        
        if (!isSuperPrimary && !isTier2Primary) {
          updatePayload.release_type = 'netflix';
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
          runtime_minutes: movie.runtime_minutes,
          poster_url: movie.poster_url,
          backdrop_url: movie.poster_url,
          release_type: 'netflix',
          streaming_links: { netflix: movie.url },
          source: 'netflix',
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

  console.log(`\n📊 Sync Complete:`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - New: ${newCount}`);
  console.log(`   - Errors: ${errorCount}`);
}

async function run() {
  try {
    const movies = await scrapeNetflix();
    await syncToDatabase(movies);
  } catch (e) {
    console.error('💀 Fatal error:', e);
    process.exit(1);
  }
}

run();
