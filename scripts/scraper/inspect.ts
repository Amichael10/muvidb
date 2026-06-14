import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
chromium.use(stealth());

async function inspectNollydata() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log("Navigating to The Figurine...");
  await page.goto("https://www.nollydata.com/movies/the_figurine", { waitUntil: 'domcontentloaded' });
  
  console.log("Extracting DOM info...");
  const data = await page.evaluate(() => {
    const genres = Array.from(document.querySelectorAll('a[href*="/genre/"], a[href*="/genres/"]')).map(el => ({ text: el.textContent?.trim(), href: el.getAttribute('href'), class: el.className }));
    const people = Array.from(document.querySelectorAll('a[href*="/people/"], a[href*="/person/"]')).map(el => ({ text: el.textContent?.trim(), href: el.getAttribute('href'), class: el.className }));
    const synopsis = document.querySelector('meta[name="description"]')?.getAttribute('content');
    
    // Attempt to find any wrapping containers for cast
    const castContainer = document.querySelector('h2:has-text("Cast"), h3:has-text("Cast")')?.parentElement?.className || "Not found";

    return {
      genres: genres.slice(0, 5),
      people: people.slice(0, 10),
      synopsis: synopsis ? synopsis.substring(0, 100) : "Not found",
      castContainer
    };
  });
  
  console.log(JSON.stringify(data, null, 2));
  await browser.close();
}

inspectNollydata().catch(console.error);
