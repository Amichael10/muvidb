import { chromium } from 'playwright';

async function testDetailApi(slug) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const url = `https://mubi.com/services/api/films/${slug}`;
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
    console.log('Keys:', Object.keys(data));
    console.log('Title:', data.title);
    console.log('Year:', data.year);
    console.log('Directors:', data.directors?.map(d => d.name));
    console.log('Sample Cast:', data.cast_members?.slice(0, 2).map(c => c.name));
    console.log('Crew count:', data.crew?.length);
    console.log('Production companies:', data.production_companies?.map(p => p.name));
  } else {
    console.log('Failed:', await response.text());
  }
  await browser.close();
}

testDetailApi('mami-wata').catch(console.error);
