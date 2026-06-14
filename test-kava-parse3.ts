import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('response', async response => {
    if (response.url().includes('kavaapi.muvi.com/content') && response.request().method() === 'POST') {
      try {
        const json = await response.json();
        if (json?.data?.contentList?.content_list) {
            const movie = json.data.contentList.content_list[0];
            if (movie) {
               console.log("Movie Keys:", Object.keys(movie));
               console.log("cast_details:", movie.cast_details);
               console.log("categories:", movie.categories);
               console.log("video_duration:", movie.video_duration);
            }
        }
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await browser.close();
})();
