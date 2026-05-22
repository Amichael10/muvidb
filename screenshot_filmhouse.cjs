const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://filmhouseng.com/');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'filmhouse.png', fullPage: true });
  await browser.close();
})();
