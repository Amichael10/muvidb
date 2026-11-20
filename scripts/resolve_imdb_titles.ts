import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1']);

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

const FIRECRAWL_KEYS = [
  process.env.FIRECRAWL_API_KEY,
  process.env.FIRECRAWL_API_KEY_2,
  process.env.FIRECRAWL_API_KEY_3,
  process.env.FIRECRAWL_API_KEY_4,
].filter(Boolean) as string[];

let keyIdx = 0;
function getKey() {
  const k = FIRECRAWL_KEYS[keyIdx % FIRECRAWL_KEYS.length];
  keyIdx++;
  return k;
}

const IDS_TO_RESOLVE = [
  'tt27072200', // Visa On Arrival
  'tt26698628',
  'tt28353848',
  'tt39390781',
  'tt37427298',
  'tt39290795',
  'tt23144036',
  'tt26450673',
  'tt39257769',
  'tt23555706',
  'tt12719884',
  'tt10167344',
  'tt22469048',
  'tt23643904',
  'tt6316634',
  'tt29278939',
  'tt23901472',
  'tt12728832',
  'tt33096902',
  'tt29537499',
  'tt32880282',
  'tt38582577',
  'tt30890638',
  'tt33090925',
  'tt37232807',
  'tt37675956',
  'tt32880855',
  'tt21361596',
  'tt32439054',
  'tt36365628',
  'tt37731888',
  'tt7953874',
  'tt10738058',
  'tt16401480',
  'tt6838464',
  'tt4184438',
  'tt9822338',
  'tt16817152',
];

async function scrapeTitle(id: string) {
  const key = getKey();
  const url = `https://www.imdb.com/title/${id}/`;
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
      }),
    });
    const data = await res.json();
    if (!data.success) {
      return { id, error: data.error };
    }
    const md = data.data?.markdown || '';
    // Extract title from H1 in markdown: # Title
    const titleMatch = md.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Unknown';
    const isSeries = md.includes('TV Series') || md.includes('TV Mini Series') || md.includes('Episode guide');
    const yearMatch = md.match(/\b(19\d\d|20\d\d)(?:–(19\d\d|20\d\d)?)?\b/);
    const ratingMatch = md.match(/(\d+\.\d+)\/10/);
    return {
      id,
      title,
      isSeries,
      year: yearMatch ? yearMatch[0] : null,
      rating: ratingMatch ? ratingMatch[1] : null,
    };
  } catch (err: any) {
    return { id, error: err.message };
  }
}

async function main() {
  console.log(`Resolving ${IDS_TO_RESOLVE.length} IMDb IDs via Firecrawl...`);
  // Process in batches of 4
  const results = [];
  for (let i = 0; i < IDS_TO_RESOLVE.length; i += 4) {
    const batch = IDS_TO_RESOLVE.slice(i, i + 4);
    const res = await Promise.all(batch.map(scrapeTitle));
    for (const r of res) {
      console.log(`[${r.id}] ${r.title} (${r.year || 'N/A'}) - ${r.isSeries ? 'SERIES' : 'MOVIE'} ${r.rating ? `[★ ${r.rating}]` : ''}`);
      results.push(r);
    }
  }
}

main().catch(console.error);
