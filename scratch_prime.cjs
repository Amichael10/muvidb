const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
chromium.use(stealth());

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  console.log('Going to search page...');
  await page.goto('https://www.primevideo.com/search/ref=atv_nb_sug?ie=UTF8&phrase=nollywood', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/detail/"]')).map(a => a.href);
  });
  
  if (links.length > 0) {
    console.log('Navigating to', links[0]);
    await page.goto(links[0], { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const html = await page.content();
    require('fs').writeFileSync('prime_detail_test.html', html);
    console.log('Saved');
  } else {
    console.log('No links found');
  }
  await browser.close();
})();
