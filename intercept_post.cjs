const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('request', req => {
    if (req.method() === 'POST' || req.url().includes('?')) {
      console.log('REQ:', req.method(), req.url());
      if (req.postData()) {
        console.log('  Data:', req.postData());
      }
    }
  });

  await page.goto('https://www.filmhouseng.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  await page.evaluate(() => {
    const loc = document.querySelector('.navselectwrap.is-location, .dropdownHeader');
    if (loc) loc.click();
  });
  await page.waitForTimeout(2000);
  
  await page.evaluate(() => {
    const items = document.querySelectorAll('.dropdownItem, li, a, div');
    for (const item of Array.from(items)) {
      if (item.textContent.includes('Lekki IMAX')) {
        item.click();
        return;
      }
    }
  });
  
  await page.waitForTimeout(3000);
  await browser.close();
})();
