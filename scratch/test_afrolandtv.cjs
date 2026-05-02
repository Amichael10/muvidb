const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const requests = [];
  page.on('response', response => {
    requests.push({ url: response.url(), type: response.request().resourceType() });
  });

  await page.goto('https://www.afrolandtv.com/?section=moviessection', { waitUntil: 'networkidle' });
  
  const content = await page.content();
  console.log("HTML length:", content.length);
  
  const apiCalls = requests.filter(r => r.type === 'fetch' || r.type === 'xhr');
  console.log("API Calls:", apiCalls.map(r => r.url));
  
  await browser.close();
})();
