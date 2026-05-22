const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('response', async (response) => {
    if (response.url().includes('api') || response.url().includes('json')) {
      console.log('API URL:', response.url());
      try {
        const body = await response.json();
        if (JSON.stringify(body).includes('showtime') || JSON.stringify(body).includes('movie')) {
          console.log('Found showtimes/movies in:', response.url());
          require('fs').writeFileSync('api_response.json', JSON.stringify(body, null, 2));
        }
      } catch(e) {}
    }
  });

  await page.goto('https://filmhouseng.com/');
  await page.waitForTimeout(5000);
  await browser.close();
})();
