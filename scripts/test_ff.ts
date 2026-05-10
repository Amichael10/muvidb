import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

const stealthPlugin = stealth();
chromium.use(stealthPlugin);

(async () => {
  const browser = await chromium.launch({headless: true});
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://filmflux.app/movies', {waitUntil: 'domcontentloaded'});
  await page.waitForSelector('a[href^="/movie/"]');
  const link = await page.evaluate(() => document.querySelector('a[href^="/movie/"]').href);
  console.log('Got link:', link);
  await page.goto(link, {waitUntil: 'domcontentloaded'});
  
  // wait for something to load
  await page.waitForTimeout(3000);

  const domStr = await page.evaluate(() => {
    // Just find the whole div that contains 'Cast' or 'Crew' and print it.
    let text = document.body.innerHTML;
    return text.substring(text.indexOf('Cast'), text.indexOf('Cast') + 5000);
  });
  console.log(domStr);
  await browser.close();
})();
