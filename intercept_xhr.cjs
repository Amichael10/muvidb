const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  page.on('request', request => {
    if (request.resourceType() === 'fetch' || request.resourceType() === 'xhr') {
      console.log('XHR/Fetch URL:', request.url(), request.method());
    }
  });
  
  page.on('response', async response => {
    if (response.request().resourceType() === 'fetch' || response.request().resourceType() === 'xhr') {
      try {
        const body = await response.json();
        console.log('Response from', response.url(), 'Body keys:', Object.keys(body));
      } catch(e) {}
    }
  });

  await page.goto('https://filmhouseng.com/');
  await page.waitForTimeout(5000);
  console.log('Clicking location...');
  await page.evaluate(() => {
    const loc = document.querySelector('.navselectwrap.is-location');
    if (loc) loc.click();
  });
  await page.waitForTimeout(3000);
  await browser.close();
})();
