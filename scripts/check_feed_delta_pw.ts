import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';

dotenv.config();

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

async function check() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const targetUrl = process.env.FEED_DELTA_URL || 'https://filmflux.app/movies';
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // wait for client render
  
  const movieLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/movie/"]')).map(a => (a as HTMLAnchorElement).href);
  });
  
  if (movieLinks.length > 0) {
    console.log("Found movie:", movieLinks[0]);
    await page.goto(movieLinks[0], { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000); // wait for client render
    
    const crew = await page.evaluate(() => {
      // Find elements that look like cast/crew
      const crewNodes = Array.from(document.querySelectorAll('div, a')).filter(el => {
         const t = el.textContent?.toLowerCase() || '';
         return t.includes('cinematographer') || t.includes('director') || t.includes('producer');
      }).map(el => el.outerHTML);
      
      // Let's also just dump all links that have "person" or "crew" or "actor"
      const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
      return { crewNodes: crewNodes.slice(0, 5), links: links.filter(l => l.includes('/crew') || l.includes('/person') || l.includes('/actor') || l.includes('/talent')) };
    });
    console.log(JSON.stringify(crew, null, 2));
  } else {
    console.log("No movies found");
  }
  await browser.close();
}

check();
