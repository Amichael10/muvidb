import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

import { Agent, setGlobalDispatcher } from 'undici';
setGlobalDispatcher(
  new Agent({
    connect: { timeout: 60000 },
    headersTimeout: 60000,
    bodyTimeout: 60000,
  })
);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
  process.env.FIRECRAWL_API_KEY_4,
].filter(Boolean) as string[];

async function testDirectFetch() {
  console.log('1. Testing direct fetch with User-Agent...');
  try {
    const res = await fetch('https://itsawrapng.com/wp-json/wp/v2/posts?per_page=5', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });
    console.log('Direct fetch status:', res.status);
    if (res.ok) {
      const posts = await res.json();
      console.log(`Success! Fetched ${posts.length} posts directly.`);
      return posts;
    }
  } catch (err: any) {
    console.warn('Direct fetch failed:', err.message);
  }
  return null;
}

async function testFirecrawlMap() {
  console.log('\n2. Testing Firecrawl Map/Crawl on itsawrapng.com...');
  for (const apiKey of FIRECRAWL_KEYS) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url: 'https://itsawrapng.com',
          search: 'review',
          limit: 50,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('Firecrawl map result count:', data.links?.length || data.data?.length);
        console.log('Sample links:', (data.links || data.data || []).slice(0, 10));
        return data;
      } else {
        console.warn('Firecrawl response not ok:', res.status, await res.text());
      }
    } catch (e: any) {
      console.warn('Firecrawl error:', e.message);
    }
  }
}

async function main() {
  const direct = await testDirectFetch();
  if (!direct) {
    await testFirecrawlMap();
  }
  process.exit(0);
}

main();
