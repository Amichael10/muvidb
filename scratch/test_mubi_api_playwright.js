import { chromium } from 'playwright';

async function testApi() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const url = 'https://api.mubi.com/v4/browse/films?historic_countries=Nigeria&page=1&per_page=24';
  console.log(`Fetching ${url}...`);
  const response = await context.request.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'client': 'web'
    }
  });
  console.log('Status:', response.status());
  if (response.ok()) {
    const data = await response.json();
    console.log(`Success! Found ${data.films.length} films.`);
    console.log('First film:', data.films[0].title);
  } else {
    console.log('Failed:', await response.text());
  }
  await browser.close();
}

testApi().catch(console.error);
