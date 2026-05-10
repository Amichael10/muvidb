import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
  const page = await context.newPage();
  await page.goto('https://filmflux.app/movies', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const movieLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/movie/"]')).map(a => (a).href);
  });
  
  if (movieLinks.length > 0) {
     await page.goto(movieLinks[0], { waitUntil: 'domcontentloaded' });
     await page.waitForTimeout(5000);
     
     const crewData = await page.evaluate(() => {
       return Array.from(document.querySelectorAll('a[href^="/crew/"]')).map(item => {
         return {
           html: item.innerHTML,
           textSm: item.querySelector('.text-sm')?.textContent,
           textXs: item.querySelector('.text-xs')?.textContent,
           p: item.querySelector('p')?.textContent,
           h3: item.querySelector('h3')?.textContent
         }
       });
     });
     console.log('Crew HTML:', JSON.stringify(crewData, null, 2));
  }
  await browser.close();
})();
