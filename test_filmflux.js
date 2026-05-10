const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
chromium.use(stealth());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0' });
  const page = await context.newPage();
  await page.goto('https://filmflux.app/movies', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const movieLinks = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href^="/movie/"]')).map(a => a.href);
  });
  console.log('Movie Links:', movieLinks.slice(0, 5));
  
  if (movieLinks.length > 0) {
     await page.goto(movieLinks[0], { waitUntil: 'domcontentloaded' });
     await page.waitForTimeout(5000);
     
     const peopleLinks = await page.evaluate(() => {
       return Array.from(document.querySelectorAll('a')).map(a => a.href).filter(h => h.includes('actor') || h.includes('crew') || h.includes('director') || h.includes('person'));
     });
     console.log('People Links:', peopleLinks);
     
     const texts = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.text-xs, .text-sm, p')).map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 50);
     });
     console.log('Text blocks:', texts.slice(0, 30));
  }
  await browser.close();
})();
