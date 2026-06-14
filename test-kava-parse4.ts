import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('kavaapi.muvi.com')) {
      try {
        const json = await response.json();
        const postData = response.request().postData() || '';
        
        console.log("\n--- API Call ---");
        console.log("URL:", response.url());
        console.log("POST Data Snippet:", postData.substring(0, 100));
        
        // Print top level keys
        if (json?.data) {
           console.log("Data keys:", Object.keys(json.data));
           // If cast is present
           if (JSON.stringify(json).toLowerCase().includes('kanayo')) {
               console.log("!!! FOUND KANAYO IN THIS RESPONSE !!!");
               console.log("Keys deep in data:", Object.keys(json.data)[0]);
               // Dump a bit
               console.log(JSON.stringify(json.data).substring(0, 200));
           }
           if (JSON.stringify(json).toLowerCase().includes('29m')) {
               console.log("!!! FOUND DURATION IN THIS RESPONSE !!!");
           }
        }
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000);
  await browser.close();
})();
