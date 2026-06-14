import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'c:\\Users\\User\\Filmdba\\lumi\\kava.png', fullPage: true });
  await browser.close();
})();
