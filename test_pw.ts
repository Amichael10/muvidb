import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log("Navigating to https://www.nollydata.com/movies");
  const response = await page.goto("https://www.nollydata.com/movies", { waitUntil: 'domcontentloaded' });
  console.log("Status:", response?.status());
  
  await page.waitForTimeout(5000);
  
  const html = await page.content();
  console.log("HTML length:", html.length);
  
  // Extract all links
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a')).map(a => a.getAttribute('href')).filter(h => h);
  });
  
  console.log("Found", links.length, "links");
  console.log("First 30 links:", links.slice(0, 30));
  
  // Also check if any links contain 'movie' or 'film'
  const movieLinks = links.filter(l => l.toLowerCase().includes('movie') || l.toLowerCase().includes('film'));
  console.log("Links containing 'movie' or 'film':", movieLinks.slice(0, 20));
  
  await browser.close();
}

run().catch(console.error);
