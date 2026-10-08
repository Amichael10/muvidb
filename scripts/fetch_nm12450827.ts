import 'dotenv/config';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'node:fs';

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
].filter(Boolean) as string[];

async function main() {
  const url = 'https://www.imdb.com/name/nm12450827/';
  console.log('Fetching', url);
  for (const key of FIRECRAWL_KEYS) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ url, formats: ['markdown', 'html', 'links'] }),
      });
      const data: any = await res.json();
      if (res.ok && data.success) {
        console.log('Fetched successfully with Firecrawl!');
        fs.writeFileSync('scratch_nm12450827.json', JSON.stringify(data.data, null, 2));
        console.log('Saved to scratch_nm12450827.json');
        console.log('Markdown snippet:\n', data.data.markdown?.slice(0, 1000));
        return;
      }
      console.warn('Firecrawl key attempt failed:', data.error || res.status);
    } catch (e: any) {
      console.warn('Error:', e.message);
    }
  }

  // Fallback to fetch with headers
  console.log('Trying direct fetch with browser headers...');
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  console.log('Direct status:', res.status);
  const html = await res.text();
  fs.writeFileSync('scratch_nm12450827.html', html);
  console.log('Saved HTML to scratch_nm12450827.html (length:', html.length, ')');
}

main().catch(console.error);
