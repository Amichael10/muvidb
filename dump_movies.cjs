const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://filmhouseng.com/');
  
  await page.waitForTimeout(5000);
  console.log('Evaluating movies...');
  const movies = await page.evaluate(() => {
    const movieNodes = document.querySelectorAll('[class*="movie"]');
    return Array.from(movieNodes).map(n => n.outerHTML).slice(0, 3);
  });
  console.log('Movies:', movies);
  await browser.close();
})();
