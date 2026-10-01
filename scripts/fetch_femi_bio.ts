import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY || process.env.FIRECRAWL_API_KEY_2;

async function firecrawl(url: string) {
  console.log('Fetching:', url);
  const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIRECRAWL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: false,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data.data || data;
}

async function main() {
  const bioData = await firecrawl('https://www.imdb.com/name/nm2143567/bio/');
  fs.writeFileSync('scratch/femi_bio.json', JSON.stringify(bioData, null, 2));
  console.log('✅ Fetched Femi Branch Bio!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
