import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('request', request => {
    if (request.url().includes('kavaapi.muvi.com')) {
      console.log('API Request:', request.url(), '| POST Data:', request.postData());
    }
  });

  page.on('response', async response => {
    if (response.url().includes('kavaapi.muvi.com')) {
      try {
        const text = await response.text();
        console.log('API Response:', response.url(), '| Body length:', text.length, '| Snippet:', text.substring(0, 500));
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // wait for apis to resolve
  await browser.close();
})();
