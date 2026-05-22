const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://filmhouseng.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());
  
  console.log('Clicking location dropdown...');
  await page.evaluate(() => {
    const loc = document.querySelector('.navselectwrap.is-location, .dropdownHeader');
    if (loc) loc.click();
  });
  await page.waitForTimeout(2000);
  
  console.log('Clicking Lekki IMAX...');
  await page.evaluate(() => {
    const items = document.querySelectorAll('.dropdownItem, li, a, div');
    for (const item of Array.from(items)) {
      if (item.textContent.trim() === 'Lekki IMAX' || item.textContent.includes('Lekki IMAX')) {
        item.click();
        return;
      }
    }
  });
  
  await page.waitForTimeout(5000);
  
  console.log('New URL:', page.url());
  const html = await page.content();
  require('fs').writeFileSync('filmhouse_after_click.html', html);
  
  const movies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, .title, .pc-movie-item')).map(n => n.textContent.trim()).filter(Boolean).slice(0, 20);
  });
  console.log('Headers on new page:', movies);
  
  await browser.close();
})();
