import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('kavaapi.muvi.com/content') && response.request().method() === 'POST') {
      try {
        const json = await response.json();
        // Just look for anything that might have our data
        if (json?.data) {
          console.log("Found Data Keys:", Object.keys(json.data));
          if (json.data.contentList) {
            console.log("Content List Keys:", Object.keys(json.data.contentList));
            console.log("Content List Array Length:", json.data.contentList.content_list?.length);
            const movie = json.data.contentList.content_list?.[0];
            if (movie) {
               console.log("Movie Data:");
               console.log(JSON.stringify(movie, null, 2).substring(0, 500) + "...");
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000); // wait for api
  await browser.close();
})();
