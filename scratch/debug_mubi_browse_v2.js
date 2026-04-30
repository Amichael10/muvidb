import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

chromium.use(stealth());

async function debug() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Try the URL from sync-mubi.ts
  const url = 'https://mubi.com/en/films?all_films=true&country=Nigeria&page=1';
  console.log(`Visiting ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const nextDataStr = await page.evaluate(() => document.getElementById('__NEXT_DATA__')?.textContent);
  if (nextDataStr) {
    const data = JSON.parse(nextDataStr);
    console.log('Keys in pageProps:', Object.keys(data.props.pageProps));
    if (data.props.pageProps.films) {
      console.log(`Found ${data.props.pageProps.films.length} films`);
    } else {
      console.log('No "films" key in pageProps');
    }
    fs.writeFileSync('scratch/debug_mubi_v2.json', JSON.stringify(data, null, 2));
  } else {
    console.log('__NEXT_DATA__ not found');
  }
  await browser.close();
}

debug().catch(console.error);
