const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const keys = [all.FIRECRAWL_API_KEY, all.FIRECRAWL_API_KEY_2, all.FIRECRAWL_API_KEY_3, all.FIRECRAWL_API_KEY_4].filter(Boolean);
let keyIdx = 0;

async function scrape(url) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(keyIdx++) % keys.length];
    try {
      console.log(`Scraping ${url} with key ...${k.slice(-6)}`);
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          formats: ['markdown', 'html']
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      } else {
        console.warn(`Attempt failed:`, json.error || json);
      }
    } catch (e) {
      console.error(`Error:`, e.message);
    }
  }
  return null;
}

async function run() {
  // 1. Name page
  const nameData = await scrape('https://www.imdb.com/name/nm5931748/');
  if (nameData?.markdown) {
    fs.writeFileSync('scratch/zynnell_name_page.md', nameData.markdown);
    console.log('Saved scratch/zynnell_name_page.md');
  }

  // 2. Search titles by role
  const searchData = await scrape('https://www.imdb.com/search/title/?role=nm5931748');
  if (searchData?.markdown) {
    fs.writeFileSync('scratch/zynnell_search_results.md', searchData.markdown);
    console.log('Saved scratch/zynnell_search_results.md');
  }
}

run();
