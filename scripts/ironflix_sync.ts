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

const IRONFLIX_URL = 'https://www.ironflix.com/movies';

async function scrapeIronflix() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  console.log(`🚀 Navigating to Ironflix: ${IRONFLIX_URL}`);
  await page.goto(IRONFLIX_URL, { waitUntil: 'networkidle' });

  let movieUrls = new Set<string>();
  let pageNum = 1;
  const maxPages = 5;

  // 1. Discover URLs
  while (pageNum <= maxPages) {
    console.log(`🔍 Discovering URLs on Page ${pageNum}...`);
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a.browse-item-link'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(url => url && !url.includes('javascript:'));
    });
    
    links.forEach(url => movieUrls.add(url));
    console.log(`✅ Found ${links.length} links on page ${pageNum}.`);

    const nextLink = await page.$(`a[href*="page=${pageNum + 1}"]`);
    if (nextLink && pageNum < maxPages) {
      await nextLink.click();
      await page.waitForLoadState('networkidle');
      pageNum++;
    } else {
      break;
    }
  }

  console.log(`📽️ Discovered ${movieUrls.size} unique movie URLs. Starting deep extraction...`);
  
  const allMovies: any[] = [];
  for (const url of Array.from(movieUrls)) {
    console.log(`📄 Fetching details for: ${url}`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      const rawData = await page.evaluate(() => {
        const titleEl = document.querySelector('h1.site-font-primary-family, h1');
        const synopsisEl = document.querySelector('.browse-description p, .browse-description');
        const posterEl = document.querySelector('.browse-item-poster img, .browse-image-container img, img[alt*="poster" i]');
        const durationEl = document.querySelector('.duration, .video-duration');
        const bodyText = document.body.innerText;
        
        return {
          title: titleEl?.textContent?.trim() || 'Unknown',
          synopsis: synopsisEl?.textContent?.trim() || '',
          runtimeStr: durationEl?.textContent?.trim() || '',
          poster_url: (posterEl as HTMLImageElement)?.src || null,
          bodyText
        };
      });

      if (rawData.title !== 'Unknown') {
        const yearMatch = rawData.bodyText.match(/\b(19|20)\d{2}\b/);
        const castMatch = rawData.bodyText.match(/(?:STARRING|CAST):\s*([^\n.]+)/i);
        const genreMatches = rawData.synopsis.match(/([A-Z\s]+(?:\s*\|\s*[A-Z\s]+)+)/);
        
        const parseRuntime = (str: string) => {
          if (!str) return null;
          const hMatch = str.match(/(\d+)\s*h/i);
          const mMatch = str.match(/(\d+)\s*m/i);
          let total = 0;
          if (hMatch) total += parseInt(hMatch[1]) * 60;
          if (mMatch) total += parseInt(mMatch[1]);
          return total > 0 ? total : null;
        };

        allMovies.push({
          ...rawData,
          url,
          year: yearMatch ? yearMatch[0] : null,
          runtime_minutes: parseRuntime(rawData.runtimeStr),
          cast: castMatch ? castMatch[1].split(',').map(s => s.trim()) : [],
          genres: genreMatches ? genreMatches[0].split('|').map(g => g.trim()) : []
        });
      }
    } catch (e) {
      console.error(`  ❌ Failed to fetch ${url}: ${e.message}`);
    }
    await page.waitForTimeout(1000 + Math.random() * 1000);
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
    .insert({ name, source: 'ironflix' })
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
    const movieYear = movie.year ? parseInt(movie.year) : null;
    
    console.log(`🔄 Processing: ${cleanedTitle} (${movieYear || 'N/A'})`);

    try {
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
          ironflix: movie.url 
        };

        const updatePayload: any = {
          streaming_links: newStreamingLinks,
          synopsis: existing.synopsis || movie.synopsis,
          year: existing.year || movieYear,
          runtime_minutes: existing.runtime_minutes || movie.runtime_minutes,
          poster_url: existing.poster_url || movie.poster_url
        };

        const isPrimaryLinkAvailable = existing.youtube_watch_url || existing.release_type === 'kava';
        if (!isPrimaryLinkAvailable) {
          updatePayload.release_type = 'ironflix';
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
          release_type: 'ironflix',
          streaming_links: { ironflix: movie.url },
          source: 'ironflix',
          status: 'released',
          countries: ['Nigeria'],
          needs_review: true
        }).select('id').single();

        if (error) throw error;
        filmId = inserted.id;
        newCount++;
        console.log(`  ✨ Created new record.`);
      }

      // Sync Genres
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

      // Sync Cast
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

  console.log(`\n📊 Ironflix Sync Complete:`);
  console.log(`   - Updated: ${updatedCount}`);
  console.log(`   - New: ${newCount}`);
  console.log(`   - Errors: ${errorCount}`);
}

async function run() {
  const movies = await scrapeIronflix();
  await syncToDatabase(movies);
}

run();
