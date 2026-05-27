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

async function scrapeGenesis() {
  const startTime = Date.now();
  console.log('🌍 Starting Genesis Scraper...');

  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'genesis',
    status: 'running',
    message: 'Scraping Genesis showtimes...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  const locations = [
    { name: 'Genesis Maryland', url: 'https://genesiscinemas.com/maryland-mall-maryland/', cinemaId: '0aef7f74-d8dd-4847-b652-e167285993c0' },
    { name: 'Genesis Lekki', url: 'https://genesiscinemas.com/freedom-way-lekki/', cinemaId: 'c833f1dd-7c40-4f9a-ac31-0d8a4708caa6' },
    { name: 'Genesis Festac', url: 'https://genesiscinemas.com/festival-mall-festac-lagos/', cinemaId: '92ae9a89-7dfc-44fb-9240-0d6c7f1e64f7' },
    { name: 'Genesis Abuja', url: 'https://genesiscinemas.com/ceddi-plaza-abuja/', cinemaId: '3843be4b-7ae3-4a10-9fdf-f6b79c6ae957' },
    { name: 'Genesis Port Harcourt', url: 'https://genesiscinemas.com/genesis-center-port-harcourt/', cinemaId: 'e25ff010-cf5e-4b99-a8fd-4f6b681dd2c1' },
    { name: 'Genesis Owerri', url: 'https://genesiscinemas.com/owerri-mall-owerri/', cinemaId: '7c2945dd-b6c5-431b-81c9-b4ead987033f' },
    { name: 'Genesis Asaba', url: 'https://genesiscinemas.com/asaba-mall-delta-state/', cinemaId: '52a0c538-1cc0-456d-afbc-f6531f8770c8' },
    { name: 'Genesis Warri', url: 'https://genesiscinemas.com/warri-delta-mall-effurun/', cinemaId: '981bd41a-6979-4c44-aa5c-4f120e5cc568' }
  ];

  const today = new Date().toISOString().split('T')[0];
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalErrors = 0;

  try {
    for (const loc of locations) {
      console.log(`📍 Processing ${loc.name}...`);
      try {
        await page.goto(loc.url, { waitUntil: 'networkidle', timeout: 60000 });
        
        try {
          await page.waitForSelector('.movie-tabs', { timeout: 30000 });
        } catch (e) {
          console.log(`  ⚠️ No movies found or took too long to load for ${loc.name}`);
          continue;
        }

        const films = await page.evaluate(() => {
          const movieNodes = document.querySelectorAll('.movie-tabs');
          return Array.from(movieNodes).map(node => {
            const titleEl = node.querySelector('h3 a');
            const imgEl = node.querySelector('img#jacroappimg');
            const showtimeEls = node.querySelectorAll('.perfbtn');
            const synopsisEl = node.querySelector('header p');

            const showtimes = Array.from(showtimeEls).map(btn => ({
              time: btn.textContent?.trim().replace(/\s+VIP$/i, '') || '',
              format: btn.textContent?.toLowerCase().includes('vip') ? 'VIP' : 'Standard',
              ticketUrl: btn.getAttribute('href')
            }));

            return {
              title: titleEl ? titleEl.textContent?.trim() : 'Unknown Title',
              posterUrl: imgEl ? imgEl.getAttribute('src') : null,
              synopsis: synopsisEl ? synopsisEl.textContent?.trim() : null,
              showtimes
            };
          });
        });

        console.log(`  Found ${films.length} films for ${loc.name}`);
        totalProcessed += films.length;
        
        for (const film of films) {
          const rawTitle = film.title!.replace(/\s+VIP$/i, '').replace(/\(vip\)/i, '').replace(/\(ambition\)/i, '').trim();
          const cleanTitleStr = cleanTitle(rawTitle);
          console.log(`    🔍 Syncing ${cleanTitleStr}...`);
          
          let { data: dbFilm } = await supabase
            .from('films')
            .select('id, title')
            .neq('source', 'youtube')
            .neq('source', 'tmdb_youtube')
            .ilike('title', cleanTitleStr)
            .maybeSingle();

          if (!dbFilm && cleanTitleStr.length > 3) {
            const { data: fuzzyFilms } = await supabase
              .from('films')
              .select('id, title')
              .neq('source', 'youtube')
              .neq('source', 'tmdb_youtube')
              .ilike('title', `${cleanTitleStr}%`)
              .limit(5);
              
            if (fuzzyFilms && fuzzyFilms.length > 0) {
              dbFilm = fuzzyFilms.sort((a, b) => a.title.length - b.title.length)[0];
              console.log(`      ✨ Fuzzy matched ${cleanTitleStr} -> ${dbFilm.title}`);
            }
          }

          if (!dbFilm) {
            console.log(`      ⚠️ Film not found in DB: ${cleanTitleStr}. Attempting TMDB fetch...`);
            dbFilm = await findAndInsertMissingFilm(supabase, rawTitle);
          }

          if (!dbFilm) {
            console.log(`      ❌ Could not resolve film: ${cleanTitleStr}`);
            continue;
          }

          const uniqueShowtimes: any[] = [];
          const seen = new Set();
          film.showtimes.forEach(s => {
            const key = `${s.time}-${s.format}`;
            if (!seen.has(key)) {
              uniqueShowtimes.push(s);
              seen.add(key);
            }
          });

          await supabase
            .from('showtimes')
            .delete()
            .match({ film_id: dbFilm.id, cinema_id: loc.cinemaId, show_date: today });

          const showtimesToInsert = uniqueShowtimes.map(s => ({
            film_id: dbFilm!.id,
            cinema_id: loc.cinemaId,
            show_date: today,
            show_time: s.time + ':00',
            format: 'Standard', // Enforce 'Standard' to prevent check constraint violations
            ticket_url: s.ticketUrl,
            source: 'genesis_playwright',
            is_available: true,
            last_seen_at: new Date().toISOString()
          }));

          const { error: insertError } = await supabase
            .from('showtimes')
            .insert(showtimesToInsert);

          if (insertError) {
            console.error(`      ❌ Error inserting showtimes for ${cleanTitleStr}:`, insertError.message);
            totalErrors++;
          } else {
            console.log(`      ✅ Synced ${showtimesToInsert.length} showtimes`);
            totalInserted += showtimesToInsert.length;
          }
        }
        
      } catch (err: any) {
        console.error(`  ❌ Error scraping ${loc.name}:`, err.message);
        totalErrors++;
      }
    }

    if (logId) {
      await supabase.from('sync_logs').update({
        status: totalErrors === 0 ? 'success' : 'partial',
        message: `Genesis sync complete. Processed ${totalProcessed} films, synced ${totalInserted} showtimes.`,
        details: { total_processed: totalProcessed, total_inserted: totalInserted, errors: totalErrors },
        duration_ms: Date.now() - startTime,
        items_processed: totalProcessed,
        items_updated: totalInserted,
        items_failed: totalErrors
      }).eq('id', logId);
    }

  } catch (err: any) {
    console.error("Genesis Scraper failed:", err);
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

scrapeGenesis();
