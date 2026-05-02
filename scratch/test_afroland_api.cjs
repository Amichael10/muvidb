const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('getreferencedobjects')) {
      try {
        const json = await response.json();
        console.log(`Intercepted API data from: ${url}`);
        // Log the keys and the first item
        console.log(Object.keys(json));
        if (json.objects && json.objects.length > 0) {
           const fs = require('fs');
           fs.writeFileSync('scratch/afroland_api_sample.json', JSON.stringify(json.objects[0], null, 2));
           console.log("Wrote sample object to scratch/afroland_api_sample.json");
           process.exit(0);
        }
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://www.afrolandtv.com/?section=moviessection', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
