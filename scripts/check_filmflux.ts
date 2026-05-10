import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

async function check() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://filmflux.app/movies', { waitUntil: 'domcontentloaded' });
  const movieLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/movie/"]')).map(a => (a as HTMLAnchorElement).href);
  });
  
  if (movieLinks.length > 0) {
    await page.goto(movieLinks[0], { waitUntil: 'domcontentloaded' });
    const castcrew = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href^="/crew/"], a[href^="/person/"], a[href^="/actor/"]')).map(a => a.outerHTML);
    });
    console.log(castcrew);
  }
  await browser.close();
}

check();
