import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config();

async function testImages() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const testUrl = 'https://www.primevideo.com/detail/0S8V0U8Q7U8R/'; // Replace with a real ID if needed
  
  console.log(`Testing images for: ${testUrl}`);
  await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // Wait for dynamic content
  
  const images = await page.evaluate(() => {
    const backdropEl = document.querySelector('div[data-automation-id="hero-background"] img, .dv-node-dp-hero-image img, img[role="presentation"]');
    const posterEl = document.querySelector('img[data-testid="poster-image"], img.dv-node-dp-image, img[alt*="Poster" i]');
    
    return {
      backdrop: (backdropEl as HTMLImageElement)?.src || 'Not found',
      poster: (posterEl as HTMLImageElement)?.src || 'Not found'
    };
  });
  
  console.log('Results:', images);
  
  await page.screenshot({ path: 'prime_test.png' });
  await browser.close();
}

testImages();
