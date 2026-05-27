import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import { cleanTitle } from '../api/_lib/yt_service.js';
import { findAndInsertMissingFilm } from './lib/tmdb_cinema.js';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

// Support .env and .env.local
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function scrapeFilmhouse() {
  const startTime = Date.now();
  console.log('🔄 Starting Filmhouse Scraper...');

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'filmhouse',
    status: 'running',
    message: 'Scraping Filmhouse showtimes...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const defaultCinemaId = '6c9c38f0-f790-4573-aaa0-483d96ccaa43'; // Lekki IMAX as default fallback
  const today = new Date().toISOString().split('T')[0];
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  try {
    await page.goto('https://filmhouseng.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(5000); // Wait for React to render

    console.log(`📡 Extracting movies from homepage...`);
    
    // Extract titles using aria-label on h5 elements (new Filmhouse NextJS layout)
    const filmTitles = await page.evaluate(() => {
      const titles: string[] = [];
      const els = document.querySelectorAll('[aria-label]');
      els.forEach((el) => {
        const label = el.getAttribute('aria-label');
        if (label && el.classList.contains('heading-style-h5')) {
          titles.push(label);
        }
      });
      return Array.from(new Set(titles));
    });

    console.log(`Found ${filmTitles.length} films on homepage:`, filmTitles);
    totalProcessed = filmTitles.length;

    for (const title of filmTitles) {
      const cleanedTitle = cleanTitle(title);
      console.log(`  🎬 Syncing ${cleanedTitle}...`);
      
      let { data: dbFilm } = await supabase
        .from('films')
        .select('id, title, is_in_cinemas')
        .neq('source', 'youtube')
        .neq('source', 'tmdb_youtube')
        .ilike('title', cleanedTitle)
        .maybeSingle();

      if (!dbFilm && cleanedTitle.length > 3) {
        const { data: fuzzy } = await supabase
          .from('films')
          .select('id, title, is_in_cinemas')
          .neq('source', 'youtube')
          .neq('source', 'tmdb_youtube')
          .ilike('title', `%${cleanedTitle}%`)
          .limit(1);
        dbFilm = fuzzy && fuzzy.length > 0 ? fuzzy[0] : null;
      }

      if (!dbFilm) {
        console.log(`    ⚠️ Film not found in DB: ${cleanedTitle}. Attempting TMDB fetch...`);
        const newFilm = await findAndInsertMissingFilm(supabase, cleanedTitle);
        if (newFilm) {
          dbFilm = newFilm;
        } else {
          console.log(`    ❌ Could not resolve film: ${cleanedTitle}`);
          continue;
        }
      }

      // Ensure is_in_cinemas is true
      if (!dbFilm.is_in_cinemas) {
        await supabase.from('films').update({ is_in_cinemas: true }).eq('id', dbFilm.id);
      }

      // Instead of getting exact showtimes per location (which are now hidden behind React payloads),
      // we just clear old showtimes and insert a placeholder so it shows up in "Now Showing".
      await supabase
        .from('showtimes')
        .delete()
        .match({ film_id: dbFilm.id, cinema_id: defaultCinemaId, show_date: today });

      const showtimeToInsert = {
        film_id: dbFilm.id,
        cinema_id: defaultCinemaId,
        show_date: today,
        show_time: '12:00:00', // Placeholder
        format: 'Standard',
        source: 'filmhouse_playwright',
        is_available: true,
        last_seen_at: new Date().toISOString()
      };

      const { error } = await supabase.from('showtimes').insert(showtimeToInsert);
      if (error) {
        console.error(`    ❌ Error: ${error.message}`);
        totalErrors++;
      } else {
        console.log(`    ✅ Synced movie presence for ${cleanedTitle}`);
        totalInserted++;
      }
    }
    
    if (logId) {
      await supabase.from('sync_logs').update({
        status: totalErrors === 0 ? 'success' : 'partial',
        message: `Filmhouse sync complete. Processed ${totalProcessed} films, synced ${totalInserted} entries.`,
        details: { total_processed: totalProcessed, total_inserted: totalInserted, errors: totalErrors },
        duration_ms: Date.now() - startTime,
        items_processed: totalProcessed,
        items_updated: totalInserted,
        items_failed: totalErrors
      }).eq('id', logId);
    }

  } catch (err: any) {
    console.error("Filmhouse Scraper failed:", err);
    if (logId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: err.message,
        details: { error: err.stack },
        duration_ms: Date.now() - startTime
      }).eq('id', logId);
    }
  } finally {
    await browser.close();
  }
}

scrapeFilmhouse();
