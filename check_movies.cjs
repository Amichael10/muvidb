const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://www.filmhouseng.com/movies', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('Movies URL:', page.url());
  const movies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, .title, .pc-movie-item')).map(n => n.textContent.trim()).filter(Boolean);
  });
  console.log('Headers on Movies page:', movies.slice(0, 5));
  
  await browser.close();
})();
