const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://www.filmhouseng.com/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  const text = await page.evaluate(() => document.body.innerText);
  require('fs').writeFileSync('filmhouse_text.txt', text);
  console.log('Saved inner text to filmhouse_text.txt, length:', text.length);
  
  await browser.close();
})();
