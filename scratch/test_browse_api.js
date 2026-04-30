import { chromium } from 'playwright';

async function testBrowseApi() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const url = 'https://api.mubi.com/v4/browse/films?historic_countries[]=Nigeria&page=1&per_page=24';
  console.log(`Fetching ${url}...`);
  const response = await context.request.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'client': 'web',
      'Client-Country': 'NG'
    }
  });
  console.log('Status:', response.status());
  if (response.ok()) {
    const data = await response.json();
    console.log('Total films:', data.films?.length);
    if (data.films?.length > 0) {
      console.log('Sample film keys:', Object.keys(data.films[0]));
      console.log('Sample film details:', JSON.stringify(data.films[0], null, 2));
    }
  } else {
    console.log('Failed:', await response.text());
  }
  await browser.close();
}

testBrowseApi().catch(console.error);
