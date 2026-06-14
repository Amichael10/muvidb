import { veeziAdapter } from './api/_lib/cinema-adapters/veezi.js';

async function test() {
  const result = await veeziAdapter({ id: 'test', scrape_config: { siteToken: '4x3z2wcre0rek2beab5w344ae0' } });
  console.log('Showtimes parsed:', result.showtimes.length);
  if (result.showtimes.length > 0) {
    console.log(result.showtimes.slice(0, 3));
  } else {
    console.log('Result:', result);
  }
}

test().catch(console.error);
