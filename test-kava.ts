import { chromium } from 'playwright';
import fs from 'fs';

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  page.on('request', async request => {
    if (request.url().includes('kavaapi.muvi.com/content')) {
      console.log(`API Request: ${request.url()} | POST Data: ${request.postData()}`);
    }
  });

  console.log('Navigating to Kava.tv...');
  try {
    await page.goto('https://kava.tv/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    console.log('Goto timed out but continuing...');
  }
  await page.waitForTimeout(10000);
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'kava_screenshot.png', fullPage: true });
  console.log('Screenshot saved to kava_screenshot.png');

  // Let's see what movie elements look like now
  console.log('Extracting movie data...');
  const html = await page.content();
  fs.writeFileSync('kava-full.html', html);
  const movies = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('.col-lg-3, .col-md-4, .col-sm-6, .box'));
    return cards.map(card => {
      const text = card.textContent?.trim().substring(0, 50);
      return text;
    });
  });
  console.log(`Found ${movies.length} cards`);
  movies.slice(0, 5).forEach((text, i) => {
     console.log(`[${i}] Text: ${text}`);
  });

  await browser.close();
}

run().catch(console.error);
