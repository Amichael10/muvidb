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
  const outDir = path.resolve('scratch');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const titleData = await firecrawl('https://www.imdb.com/title/tt43598213/');
  fs.writeFileSync(path.join(outDir, 'remi_title.json'), JSON.stringify(titleData, null, 2));

  const creditsData = await firecrawl('https://www.imdb.com/title/tt43598213/fullcredits/');
  fs.writeFileSync(path.join(outDir, 'remi_credits.json'), JSON.stringify(creditsData, null, 2));

  const femiData = await firecrawl('https://www.imdb.com/name/nm2143567/');
  fs.writeFileSync(path.join(outDir, 'femi_profile.json'), JSON.stringify(femiData, null, 2));

  console.log('✅ Successfully downloaded raw Firecrawl data for Remi x Nneoma & Femi Branch!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
