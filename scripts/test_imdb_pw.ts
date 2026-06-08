import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

async function test() {
  console.log("Launching playwright browser...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  const url = 'https://www.imdb.com/title/tt21442290/fullcredits';
  console.log(`Going to ${url}...`);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log("Page loaded. Content title:", await page.title());
    const content = await page.content();
    console.log("Content length:", content.length);
    if (content.includes('Blocked') || content.includes('WAF') || content.includes('Access Denied')) {
      console.log("Still blocked by WAF!");
    } else {
      console.log("Success! Checking for cast list elements...");
      const castFound = await page.evaluate(() => {
        const castTable = document.querySelector('table.cast_list');
        return !!castTable;
      });
      console.log("Cast table found:", castFound);
    }
  } catch (err: any) {
    console.error("Error loading page:", err.message);
  } finally {
    await browser.close();
  }
}

test();
