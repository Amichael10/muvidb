import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://kava.tv/content/living-in-bondage', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // just in case
  
  // Try to find the duration string (e.g. 2h 29m 03s)
  const texts = await page.evaluate(() => {
     return Array.from(document.querySelectorAll('*'))
       .map(el => el.textContent?.trim() || '')
       .filter(t => t.match(/^\d+h\s+\d+m/));
  });
  console.log("Found duration texts:", texts.slice(0, 5));

  // Try to find cast names. They are likely in h3, h4, or span under a "Cast" section.
  const cast = await page.evaluate(() => {
     const headers = Array.from(document.querySelectorAll('h2, h3, h4, div'));
     const castHeader = headers.find(h => h.textContent?.trim() === 'Cast');
     if (!castHeader) return [];
     
     // Find the next sibling or parent's sibling that contains the list
     let container = castHeader.parentElement;
     while(container && container.tagName !== 'DIV') {
         container = container.parentElement;
     }
     if (!container) return [];
     
     // just grab all text below it, or look at the swiper-slides
     const slides = container.querySelectorAll('.swiper-slide, [class*="cast"], img');
     // Actually, let's just grab the text content of the parent section
     return (castHeader.parentElement?.parentElement?.textContent || '').split('\n').map(s => s.trim()).filter(Boolean);
  });
  console.log("Cast texts:", cast.slice(0, 20));

  await browser.close();
})();
