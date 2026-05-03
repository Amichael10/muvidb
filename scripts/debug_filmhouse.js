import { chromium } from 'playwright';
import fs from 'fs';

async function debugFilmhouse() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('🌍 Debugging Filmhouse Lekki...');
  try {
    await page.goto('https://filmhouseng.com/en/cinemas/lekki/movies', { waitUntil: 'networkidle', timeout: 60000 });
    
    // Wait for content to load
    await page.waitForTimeout(5000);
    
    const html = await page.content();
    fs.writeFileSync('filmhouse_debug.html', html);
    console.log('✅ Captured filmhouse_debug.html');
    
    const movies = await page.evaluate(() => {
      // Basic probe
      return {
        hasMovies: !!document.querySelector('.movie-card, .movie-item, article, [class*="movie"]'),
        classes: Array.from(document.querySelectorAll('*')).map(el => el.className).filter(c => c.includes('movie')).slice(0, 10)
      };
    });
    console.log('Probe results:', movies);
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    await browser.close();
  }
}

debugFilmhouse();
