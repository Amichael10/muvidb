import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import { supabase } from '../api/_lib/supabase.js';

chromium.use(stealth());

// IMDb Advanced Search URL for Feature Films, TV Movies, etc., Country = Nigeria
const IMDB_SEARCH_URL = 'https://www.imdb.com/search/title/?countries=NG&title_type=feature,tv_movie,video';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeBulkNollywood() {
  console.log('🎬 Starting bulk Nollywood scrape from IMDb...');
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(IMDB_SEARCH_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    let hasMore = true;
    let pagesScraped = 0;
    
    // Scrape a few pages for this demo script
    while (hasMore && pagesScraped < 5) {
      console.log(`📄 Scraping page ${pagesScraped + 1}...`);
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
      
      console.log(`Found ${movies.length} movies on this page.`);
      
      for (const movie of movies) {
        if (!movie.title) continue;
        
        console.log(`🍿 Saving movie: ${movie.title}`);
        
        // Check if movie exists
        const { data: existingMovie } = await supabase.from('films').select('id').ilike('title', movie.title).maybeSingle();
        
        if (!existingMovie) {
          await supabase.from('films').insert({
            title: movie.title,
            source: 'imdb'
          });
        }
      }
      
      // Try to go to next page (IMDb uses infinite scroll / load more)
      const loadMoreBtn = await page.$('button.ipc-see-more__button');
      if (loadMoreBtn) {
        await loadMoreBtn.click();
        await delay(3000);
        pagesScraped++;
      } else {
        hasMore = false;
      }
    }
    
    console.log('✅ Bulk scrape completed!');
    
  } catch (error) {
    console.error('❌ Error during bulk scrape:', error);
  } finally {
    await browser.close();
  }
}

scrapeBulkNollywood();
