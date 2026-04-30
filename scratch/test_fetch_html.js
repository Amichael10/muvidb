import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function testFetchHtml(slug) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const url = `https://mubi.com/en/films/${slug}`;
  console.log(`Fetching ${url}...`);
  const response = await context.request.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    }
  });
  console.log('Status:', response.status());
  if (response.ok()) {
    const html = await response.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
    if (match) {
      const data = JSON.parse(match[1]);
      console.log('Title:', data.props.pageProps.initFilm.title);
      console.log('Year:', data.props.pageProps.initFilm.year);
    } else {
      console.log('No __NEXT_DATA__ found');
    }
  } else {
    console.log('Failed:', await response.text());
  }
  await browser.close();
}

testFetchHtml('mami-wata').catch(console.error);
