import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
import { cleanTitle } from '../api/_lib/yt_service.js';

// Support .env and .env.local
const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const envDefault = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const env = { ...envDefault, ...envLocal, ...process.env };

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env or .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function generateSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

async function scrapeIronflix() {
  console.log("Launching Playwright for Ironflix Sync...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const allMovies: any[] = [];
  const maxPages = env.MAX_PAGES ? parseInt(env.MAX_PAGES as string) : 10;
  
  // Scrape pages
  for (let p = 1; p <= maxPages; p++) {
    const url = p === 1 ? 'https://www.ironflix.com/movies' : `https://www.ironflix.com/movies?page=${p}`;
    console.log(`Scraping ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      await page.waitForSelector('.browse-item-card', { timeout: 15000 });
      console.log(`Found items on page ${p}`);
    } catch (e) {
      console.warn(`No items found or timeout on page ${p}. Stopping pagination.`);
      break;
    }
    
    const movies = await page.evaluate(() => {
      const items: any[] = [];
      document.querySelectorAll('.browse-item-card').forEach(el => {
        const titleEl = el.querySelector('.browse-item-title strong') || el.querySelector('.browse-item-title');
        const linkEl = el.querySelector('a.browse-item-link') as HTMLAnchorElement;
        
        if (titleEl && linkEl) {
          const rawProps = linkEl.getAttribute('data-track-event-properties');
          let id = null;
          if (rawProps) {
            try {
              id = JSON.parse(rawProps).id;
            } catch (e) {}
          }
          
          let posterUrl = null;
          const imgEl = el.querySelector('img');
          if (imgEl && imgEl.src) {
            posterUrl = imgEl.src;
          } else {
            const posterDiv = el.querySelector('.browse-item-poster') || el.querySelector('.browse-image-container');
            if (posterDiv) {
              const style = window.getComputedStyle(posterDiv);
              const bg = style.backgroundImage;
              const match = bg.match(/url\(["']?(.*?)["']?\)/);
              if (match && match[1] !== 'none') posterUrl = match[1];
            }
          }
          
          let description = '';
          let castText = '';
          
          if (id) {
            const tooltip = document.querySelector(`#collection-tooltip-${id}`);
            if (tooltip) {
              const paragraphs = tooltip.querySelectorAll('.transparent p');
              if (paragraphs.length > 0) {
                description = (paragraphs[0] as HTMLElement).innerText.trim();
              }
              if (paragraphs.length > 1) {
                castText = (paragraphs[1] as HTMLElement).innerText.trim().replace(/^Cast:\s*/i, '');
              } else if (description.toLowerCase().startsWith('cast:')) {
                castText = description.replace(/^Cast:\s*/i, '');
                description = '';
              }
            }
          }
          
          items.push({
            title: (titleEl as HTMLElement).innerText.trim(),
            url: linkEl.href,
            poster_url: posterUrl,
            source_video_id: id ? id.toString() : null,
            description,
            castText
          });
        }
      });
      return items;
    });
    
    allMovies.push(...movies);
    
    // Slight delay between pages
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  await browser.close();
  return allMovies;
}

async function run() {
  const startTime = Date.now();
  console.log("🚀 Starting Ironflix Sync...");
  
  // 1. Create a "running" log entry
  const { data: logEntry } = await supabase.from('sync_logs').insert({
    source: 'ironflix',
    status: 'running',
    message: 'Scraping Ironflix movie catalog...',
    details: { started_at: new Date().toISOString() }
  }).select().single();
  
  const logId = logEntry?.id;

  try {
    const scrapedMovies = await scrapeIronflix();
    console.log(`Found ${scrapedMovies.length} films to process from Ironflix.`);
    
    if (scrapedMovies.length === 0) {
      console.log("No films found, exiting.");
      if (logId) {
        await supabase.from('sync_logs').update({
          status: 'success',
          message: 'No new films found on Ironflix.',
          duration_ms: Date.now() - startTime
        }).eq('id', logId);
      }
      return;
    }
    
    const filmsToUpsert = scrapedMovies.filter(m => m.source_video_id).map(movie => {
      const img = movie.poster_url;
      const cleanedTitle = cleanTitle(movie.title);
      
      return {
        title: cleanedTitle,
        synopsis: movie.description,
        poster_url: img,
        backdrop_url: img,
        source: 'ironflix',
        source_video_id: movie.source_video_id,
        youtube_watch_url: movie.url,
        release_type: 'ironflix',
        countries: ['Nigeria'], // Base assumption for Ironflix
        needs_review: false,
        status: 'released'
      };
    });
    
    let inserted = 0;
    let errors = 0;
    
    for (const film of filmsToUpsert) {
      const { data: existing } = await supabase
        .from('films')
        .select('id')
        .eq('source', 'ironflix')
        .eq('source_video_id', film.source_video_id)
        .maybeSingle();
        
      if (!existing) {
        const { error } = await supabase.from('films').insert([film]);
        if (error) {
          console.error(`Error inserting ${film.title}:`, error.message);
          errors++;
        } else {
          inserted++;
        }
      }
    }
    
    console.log(`\nDONE! Inserted ${inserted} new films from Ironflix. Errors: ${errors}.`);
    
    if (logId) {
      await supabase.from('sync_logs').update({
        status: errors === 0 ? 'success' : 'partial',
        message: `Ironflix sync complete. Inserted ${inserted} new films.`,
        details: { 
          total_scraped: scrapedMovies.length, 
          inserted, 
          errors,
          completed_at: new Date().toISOString() 
        },
        duration_ms: Date.now() - startTime,
        items_processed: scrapedMovies.length,
        items_updated: inserted,
        items_failed: errors
      }).eq('id', logId);
    }
    
  } catch (err: any) {
    console.error("Scraping and Sync failed:", err);
    if (logId) {
      await supabase.from('sync_logs').update({
        status: 'error',
        message: err.message,
        details: { error: err.stack },
        duration_ms: Date.now() - startTime
      }).eq('id', logId);
    }
    process.exit(1);
  }
}

run();
