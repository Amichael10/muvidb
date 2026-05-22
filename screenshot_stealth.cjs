const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  
  await page.goto('https://www.filmhouseng.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: 'filmhouse_home.png', fullPage: true });
  console.log('Saved screenshot to filmhouse_home.png');
  
  await browser.close();
})();
