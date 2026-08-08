import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

async function main() {
  const imdbId = 'nm5392468';
  console.log(`🎬 Launching Playwright to scrape IMDb profile for ${imdbId}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();
  await page.goto(`https://www.imdb.com/name/${imdbId}/`, { waitUntil: 'networkidle' });

  const title = await page.title();
  console.log('Page Title:', title);

  const h1 = await page.locator('h1').allTextContents();
  console.log('H1 headings:', h1);

  const heroName = await page.locator('[data-testid="hero__pageTitle"]').textContent().catch(() => null);
  console.log('Hero Name:', heroName);

  const allText = await page.locator('body').innerText();
  console.log('--- BODY TEXT SNIPPET ---');
  console.log(allText.slice(0, 2000));

  await browser.close();
}

main().catch(console.error);
