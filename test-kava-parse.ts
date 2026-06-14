import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  let movieData: any = null;

  page.on('response', async response => {
    if (response.url().includes('kavaapi.muvi.com/content') && response.request().method() === 'POST') {
      try {
        const json = await response.json();
        // check if this is the contentList query response
        if (json?.data?.contentList?.content_list?.[0]) {
          movieData = json.data.contentList.content_list[0];
        }
      } catch (e) {
        // ignore
      }
    }
  });

  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000); // wait for api
  await browser.close();

  if (movieData) {
    console.log("Found Movie Data!");
    console.log("Title:", movieData.content_name);
    console.log("Duration:", movieData.video_details?.duration);
    console.log("Categories:", movieData.categories?.map((c: any) => c.category_name).join(', '));
    console.log("Cast:", movieData.cast_details?.map((c: any) => `${c.cast_name} (${c.cast_type_details?.cast_type_name})`).join(', '));
  } else {
    console.log("Failed to capture movie data.");
  }
})();
