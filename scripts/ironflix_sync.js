const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

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

function generateSlug(title) {
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
  
  const allMovies = [];
  const maxPages = process.env.MAX_PAGES ? parseInt(process.env.MAX_PAGES) : 10;
  
  // Scrape pages
  for (let p = 1; p <= maxPages; p++) {
    const url = p === 1 ? 'https://www.ironflix.com/movies' : `https://www.ironflix.com/movies?page=${p}`;
    console.log(`Scraping ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    try {
      await page.waitForSelector('.browse-item-card', { timeout: 15000 });
      console.log(`Found items on page ${p}`);
    } catch (e) {
      console.warn(`No items found on page ${p}. Stopping pagination.`);
      break;
    }
    
    const movies = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.browse-item-card').forEach(el => {
        const titleEl = el.querySelector('.browse-item-title strong') || el.querySelector('.browse-item-title');
        const linkEl = el.querySelector('a.browse-item-link');
        
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
                description = paragraphs[0].innerText.trim();
              }
              if (paragraphs.length > 1) {
                castText = paragraphs[1].innerText.trim().replace(/^Cast:\s*/i, '');
              } else if (description.toLowerCase().startsWith('cast:')) {
                castText = description.replace(/^Cast:\s*/i, '');
                description = '';
              }
            }
          }
          
          items.push({
            title: titleEl.innerText.trim(),
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
  try {
    const scrapedMovies = await scrapeIronflix();
    console.log(`Found ${scrapedMovies.length} films to process from Ironflix.`);
    
    if (scrapedMovies.length === 0) {
      console.log("No films found, exiting.");
      return;
    }
    
    const filmsToUpsert = scrapedMovies.filter(m => m.source_video_id).map(movie => {
      const img = movie.poster_url;
      const slug = generateSlug(movie.title);
      
      return {
        title: movie.title,
        synopsis: movie.description,
        poster_url: img,
        backdrop_url: img,
        source: 'ironflix',
        source_video_id: movie.source_video_id,
        youtube_watch_url: movie.url,
        release_type: 'ironflix',
        countries: ['Nigeria'], // Base assumption for Ironflix
        needs_review: false
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
        .single();
        
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
    
  } catch (err) {
    console.error("Scraping and Sync failed:", err);
    process.exit(1);
  }
}

run();
