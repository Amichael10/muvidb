import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocket from 'ws'; // Fix for Node 20

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load stealth plugin
const stealthPlugin = stealth();
chromium.use(stealthPlugin);

// Try loading .env.local first, fallback to .env
const envLocalPath = path.resolve(__dirname, '../../.env.local');
dotenv.config({ path: envLocalPath });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
// Prefer Service Role Key for backend scraping to bypass RLS
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Make sure .env.local or .env is present.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

const BASE_URL = 'https://www.nollydata.com';
const MOVIES_INDEX_URL = `${BASE_URL}/movies`;

async function saveMovieToSupabase(movie: any) {
  if (!movie || !movie.title) return;
  console.log(`  💾 Saving movie to Supabase: ${movie.title}`);
  
  const { data, error } = await supabase
    .from('films')
    .upsert({
      title: movie.title,
      synopsis: movie.synopsis,
      release_year: movie.release_year,
      duration: movie.duration,
      // Adjust field names as per your actual DB schema
    }, { onConflict: 'title' })
    .select()
    .single();
    
  if (error) {
    console.error(`  ❌ Error saving movie ${movie.title}:`, error.message);
  } else if (data) {
    console.log(`  ✅ Saved movie ID: ${data.id}`);
  }
}

async function savePersonToSupabase(person: any) {
  if (!person || !person.name) return;
  console.log(`  👤 Saving person to Supabase: ${person.name}`);
  
  const { data, error } = await supabase
    .from('people')
    .upsert({
      name: person.name,
      about: person.about,
      twitter_url: person.twitter,
      instagram_url: person.instagram,
    }, { onConflict: 'name' })
    .select()
    .single();
    
  if (error) {
    console.error(`  ❌ Error saving person ${person.name}:`, error.message);
  } else if (data) {
    console.log(`  ✅ Saved person ID: ${data.id}`);
  }
}

async function main() {
  console.log('🚀 Launching Playwright with Stealth Plugin...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  try {
    console.log(`Fetching movies index from ${MOVIES_INDEX_URL}`);
    await page.goto(MOVIES_INDEX_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for a few seconds to let JS frameworks (like React/Vue) mount and render the DOM
    await page.waitForTimeout(3000);

    const movieUrls = await page.evaluate((baseUrl) => {
      const urls: string[] = [];
      document.querySelectorAll('a').forEach(el => {
        const href = el.getAttribute('href');
        // This is a naive check; adjust it to match how nollydata links to movies
        if (href && href.includes('movies/')) {
          urls.push(href.startsWith('http') ? href : `${baseUrl}/${href.replace(/^\//, '')}`);
        }
      });
      return Array.from(new Set(urls));
    }, BASE_URL);

    console.log(`Found ${movieUrls.length} movie links.`);
    
    // Test mode: take first 3 movies
    const testUrls = movieUrls.slice(0, 3);
    
    for (const url of testUrls) {
      console.log(`\n🎬 Scraping movie details from ${url}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000); // Allow UI to render
      
      const movieData = await page.evaluate((baseUrl) => {
        // NOTE: These selectors are placeholders. Use dev tools on nollydata.com to find the exact classes.
        const title = document.querySelector('h1')?.textContent?.trim() || '';
        const synopsis = document.querySelector('.synopsis, .description, p')?.textContent?.trim() || '';
        const releaseYear = document.querySelector('.release-year')?.textContent?.trim() || '';
        const duration = document.querySelector('.duration')?.textContent?.trim() || '';
        
        const genre: string[] = [];
        document.querySelectorAll('.genre-tag').forEach(el => {
          if (el.textContent) genre.push(el.textContent.trim());
        });
        
        const cast: {name: string, url: string}[] = [];
        document.querySelectorAll('.cast-member, .actor').forEach(el => {
          const name = el.querySelector('.name')?.textContent?.trim();
          const href = el.querySelector('a')?.getAttribute('href');
          if (name) {
            cast.push({ 
              name, 
              url: href?.startsWith('http') ? href : `${baseUrl}${href}` 
            });
          }
        });

        return {
          title,
          synopsis,
          release_year: releaseYear,
          duration,
          genre: genre.join(', '),
          cast
        };
      }, BASE_URL);

      if (movieData && movieData.title) {
        await saveMovieToSupabase(movieData);
        
        for (const castMember of movieData.cast) {
          if (castMember.url) {
            console.log(`Scraping person details from ${castMember.url}`);
            await page.goto(castMember.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            await page.waitForTimeout(1500);
            
            const personData = await page.evaluate(() => {
              const name = document.querySelector('h1')?.textContent?.trim() || '';
              const about = document.querySelector('.about, .bio, p')?.textContent?.trim() || '';
              let twitter = null;
              let instagram = null;
              
              document.querySelectorAll('a').forEach(el => {
                const href = el.getAttribute('href');
                if (href) {
                  if (href.includes('twitter.com') || href.includes('x.com')) twitter = href;
                  if (href.includes('instagram.com')) instagram = href;
                }
              });
              
              return { name, about, twitter, instagram };
            });
            
            if (personData && personData.name) {
              await savePersonToSupabase(personData);
            }
          }
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Error during scraping:', error.message);
  } finally {
    await browser.close();
    console.log('✅ Done!');
  }
}

main().catch(console.error);
