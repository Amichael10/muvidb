import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
  process.env.FIRECRAWL_API_KEY_4,
].filter(Boolean) as string[];

async function run() {
  console.log('Testing Firecrawl Scrape on https://itsawrapng.com ...');
  for (let i = 0; i < FIRECRAWL_KEYS.length; i++) {
    const key = FIRECRAWL_KEYS[i];
    try {
      console.log(`Trying Key ${i + 1}...`);
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          url: 'https://itsawrapng.com',
          formats: ['markdown', 'links'],
        }),
      });

      console.log('Status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Scraped Title:', data.data?.metadata?.title);
        console.log('Total Links found:', data.data?.links?.length);
        console.log('Sample Links:', (data.data?.links || []).filter((l: string) => l.includes('itsawrapng.com')).slice(0, 15));
        console.log('\nMarkdown snippet:\n', (data.data?.markdown || '').slice(0, 500));
        process.exit(0);
      } else {
        console.warn('Scrape failed:', await res.text());
      }
    } catch (e: any) {
      console.warn('Error on key', i + 1, e.message);
    }
  }
  process.exit(1);
}

run();
