import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  await page.goto('https://www.nollydata.com/movies/jagun_jagun', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const fs = require('fs');
  fs.writeFileSync('temp_html.txt', await page.content());
  console.log('Saved to temp_html.txt');
  await browser.close();
})();
