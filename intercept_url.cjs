const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://filmhouseng.com/');
  await page.waitForTimeout(5000);
  console.log('Current URL:', page.url());
  console.log('Clicking location dropdown...');
  await page.evaluate(() => {
    const loc = document.querySelector('.navselectwrap.is-location');
    if (loc) loc.click();
  });
  await page.waitForTimeout(2000);
  console.log('Clicking Lekki IMAX...');
  await page.evaluate(() => {
    const items = document.querySelectorAll('.dropdownItem, li, a');
    for (const item of Array.from(items)) {
      if (item.textContent.includes('Lekki')) {
        item.click();
        return;
      }
    }
  });
  await page.waitForTimeout(5000);
  console.log('New URL:', page.url());
  const movies = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, .title')).map(n => n.textContent.trim()).filter(Boolean);
  });
  console.log('Headers on new page:', movies.slice(0, 20));
  await browser.close();
})();
