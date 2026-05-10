const puppeteer = require('puppeteer-extra');
const stealth = require('puppeteer-extra-plugin-stealth');
puppeteer.use(stealth());
(async () => {
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.goto('https://filmflux.app/movies', {waitUntil: 'domcontentloaded'});
  await page.waitForSelector('a[href^="/movie/"]');
  const link = await page.evaluate(() => document.querySelector('a[href^="/movie/"]').href);
  console.log('Got link:', link);
  await page.goto(link, {waitUntil: 'domcontentloaded'});
  
  const domStr = await page.evaluate(() => {
    const divs = Array.from(document.querySelectorAll('div'));
    let out = [];
    for (let d of divs) {
      if (d.textContent && (d.textContent.toLowerCase().includes('director') || d.textContent.toLowerCase().includes('cinematographer'))) {
         if (d.outerHTML.length < 2000) out.push(d.outerHTML);
      }
    }
    return out.join('\n\n---SEPARATOR---\n\n').substring(0, 5000);
  });
  console.log(domStr);
  await browser.close();
})();
