import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

chromium.use(stealth());

const IMDB_SEARCH_URL = 'https://www.imdb.com/search/title/?countries=NG&title_type=feature,tv_movie,video';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeBulkNollywood() {
  console.log('🎬 Starting deep Nollywood scrape from IMDb...');
  
  let launchOptions: any = { headless: true };
  if (process.env.SMARTPROXY_USER && process.env.SMARTPROXY_PASS) {
      console.log(`🛡️ Configuring browser to use SmartProxy: proxy.smartproxy.net:3120`);
      launchOptions.proxy = {
          server: 'http://proxy.smartproxy.net:3120',
          username: process.env.SMARTPROXY_USER,
          password: process.env.SMARTPROXY_PASS,
      };
  }

  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage();
  
  try {
    await page.goto(IMDB_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    let hasMore = true;
    let pagesScraped = 0;
    
    const movieLinksToScrape: { title: string, url: string, existingId?: string }[] = [];

    // Step 1: Collect Links
    while (hasMore && pagesScraped < 3) {
      console.log(`📄 Collecting links from search page ${pagesScraped + 1}...`);
      await page.waitForSelector('.ipc-metadata-list-summary-item', { timeout: 15000 }).catch(() => null);
      
      const movies = await page.$$eval('.ipc-metadata-list-summary-item', items => {
        return items.map(item => {
           const titleEl = item.querySelector('.ipc-title__text');
           const linkEl = item.querySelector('a.ipc-title-link-wrapper');
           return {
             title: titleEl?.textContent?.replace(/^\d+\.\s*/, '').trim(),
             link: linkEl?.getAttribute('href')
           };
        }).filter(m => m.title && m.link);
      });
      
      for (const movie of movies) {
         if (!movie.title || !movie.link) continue;
         
         // Check if movie exists and has a synopsis
         const { data: existingMovies } = await supabase.from('films').select('id, synopsis').ilike('title', movie.title).limit(1);
         const existingMovie = existingMovies?.[0];
         
         if (existingMovie && existingMovie.synopsis) {
            console.log(`⏭️ Skipping ${movie.title} (already has full details)`);
            continue;
         }
         
         movieLinksToScrape.push({ title: movie.title, url: `https://www.imdb.com${movie.link}`, existingId: existingMovie?.id });
      }
      
      const loadMoreBtn = await page.$('button.ipc-see-more__button');
      if (loadMoreBtn) {
        await loadMoreBtn.click();
        await delay(3000);
        pagesScraped++;
      } else {
        hasMore = false;
      }
    }

    console.log(`\n🔍 Found ${movieLinksToScrape.length} movies requiring deep scrape...`);

    // Step 2: Deep Extraction
    for (const movie of movieLinksToScrape) {
      console.log(`\n🍿 Scraping details for: ${movie.title}`);
      try {
        await page.goto(movie.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await delay(3000 + Math.random() * 4000); // Anti-bot delay

        const metadata = await page.evaluate(() => {
           const title = document.querySelector('h1[data-testid="hero__pageTitle"]')?.textContent?.trim() || null;
           
           const metaListItems = Array.from(document.querySelectorAll('ul.ipc-inline-list.ipc-inline-list--show-divider li.ipc-inline-list__item'));
           
           let year = null;
           const yearEl = document.querySelector('ul.ipc-inline-list a[href*="/releaseinfo"]');
           if (yearEl && yearEl.textContent) {
               year = parseInt(yearEl.textContent.trim());
           }

           let runtimeMinutes = null;
           const runtimeText = metaListItems.length > 0 ? metaListItems[metaListItems.length - 1].textContent?.trim() : null;
           if (runtimeText && (runtimeText.includes('h') || runtimeText.includes('m'))) {
               let h = 0, m = 0;
               const hMatch = runtimeText.match(/(\d+)\s*h/);
               const mMatch = runtimeText.match(/(\d+)\s*m/);
               if (hMatch) h = parseInt(hMatch[1]);
               if (mMatch) m = parseInt(mMatch[1]);
               runtimeMinutes = (h * 60) + m;
           }
           
           const synopsis = document.querySelector('[data-testid="plot-xl"]')?.textContent?.trim() || 
                            document.querySelector('[data-testid="plot-l"]')?.textContent?.trim() || null;
                            
           const posterUrl = document.querySelector('.ipc-image')?.getAttribute('src') || null;
           const backdropUrl = document.querySelector('[data-testid="hero-media__slate"] img.ipc-image')?.getAttribute('src') || 
                               document.querySelector('[data-testid="hero-media__slate"] img')?.getAttribute('src') || 
                               posterUrl;
           
           const genreEls = Array.from(document.querySelectorAll('.ipc-chip-list__scroller a.ipc-chip'));
           const genres = genreEls.map(el => el.textContent?.trim()).filter(Boolean);

           const castEls = Array.from(document.querySelectorAll('[data-testid="title-cast-item"]'));
           const cast = castEls.map(el => {
              const nameEl = el.querySelector('[data-testid="title-cast-item__actor"]');
              const charEl = el.querySelector('[data-testid="cast-item-characters-link"]');
              const imgEl = el.querySelector('img.ipc-image');
              return {
                 name: nameEl?.textContent?.trim() || null,
                 character: charEl?.textContent?.trim() || null,
                 img: imgEl?.getAttribute('src') || null
              };
           }).filter(c => c.name);

           return { title, year, runtimeMinutes, synopsis, posterUrl, backdropUrl, genres, cast };
        });

        if (!metadata.title) {
           console.log(`⚠️ Failed to parse title on ${movie.url}`);
           continue;
        }

        console.log(`   - Year: ${metadata.year || 'Unknown'}`);
        console.log(`   - Runtime: ${metadata.runtimeMinutes || 'Unknown'} mins`);
        console.log(`   - Genres: ${metadata.genres?.join(', ') || 'None'}`);
        console.log(`   - Cast: ${metadata.cast?.length || 0} members`);

        // Insert / Update Movie
        let insertedMovie;
        let filmErr;
        
        let actualExistingId = movie.existingId;
        
        // Double check against DB using the deep title
        if (!actualExistingId) {
            const { data: deepCheck } = await supabase.from('films').select('id').ilike('title', metadata.title).limit(1);
            if (deepCheck && deepCheck.length > 0) {
               actualExistingId = deepCheck[0].id;
               console.log(`   - Found existing ID using deep title: ${actualExistingId}`);
            }
        }
        
        if (actualExistingId) {
          const { data, error } = await supabase
            .from('films')
            .update({
               year: metadata.year,
               runtime_minutes: metadata.runtimeMinutes,
               synopsis: metadata.synopsis,
               poster_url: metadata.posterUrl,
               backdrop_url: metadata.backdropUrl,
               source: 'imdb'
            })
            .eq('id', actualExistingId)
            .select('id')
            .single();
          insertedMovie = data;
          filmErr = error;
        } else {
          const { data, error } = await supabase
            .from('films')
            .insert({
               title: metadata.title,
               year: metadata.year,
               runtime_minutes: metadata.runtimeMinutes,
               synopsis: metadata.synopsis,
               poster_url: metadata.posterUrl,
               backdrop_url: metadata.backdropUrl,
               source: 'imdb'
            })
            .select('id')
            .single();
          insertedMovie = data;
          filmErr = error;
        }

        if (filmErr || !insertedMovie) {
          console.error(`❌ Error saving film ${metadata.title}:`, filmErr);
          continue;
        }

        const movieId = insertedMovie.id;

        // Insert Cast
        for (const actor of metadata.cast) {
           if (!actor.name) continue;
           
           const { data: existingPerson } = await supabase.from('people').select('id').ilike('name', actor.name).maybeSingle();
           let personId = existingPerson?.id;

           if (!personId) {
             const { data: newPerson } = await supabase.from('people').insert({
               name: actor.name,
               profile_image_url: actor.img,
               source: 'imdb'
             }).select('id').single();
             personId = newPerson?.id;
           }

           if (personId) {
             const { error: castErr } = await supabase.from('film_cast').upsert({
               film_id: insertedMovie.id,
               person_id: personId,
               role_type: 'actor',
               character_name: actor.character
             }, { onConflict: 'film_id, person_id' });
           }
        }

      } catch (e: any) {
        console.error(`❌ Failed scraping ${movie.url}:`, e.message);
      }
    }
    
    console.log('\n✅ Bulk deep scrape completed!');
    
  } catch (error) {
    console.error('❌ Error during bulk scrape:', error);
  } finally {
    await browser.close();
  }
}

scrapeBulkNollywood();
