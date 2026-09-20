const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const keys = [all.FIRECRAWL_API_KEY_2, all.FIRECRAWL_API_KEY_3, all.FIRECRAWL_API_KEY_4].filter(Boolean);
let keyIdx = 0;

const titles = JSON.parse(fs.readFileSync('scratch/all_bidemi_titles.json'));

async function scrapeWithFirecrawl(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const k = keys[keyIdx % keys.length];
    keyIdx++;
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          formats: ['markdown']
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
      console.warn(`  [Retry ${attempt + 1}] Scraping ${url} failed with key ...${k.slice(-6)}:`, json.error || json);
    } catch (e) {
      console.warn(`  [Retry ${attempt + 1}] Error fetching ${url}:`, e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return null;
}

async function main() {
  console.log(`🎬 Fetching fullcredits for ${titles.length} Bidemi Kosoko titles...`);

  let fetchedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < titles.length; i++) {
    const item = titles[i];
    const outPath = `scratch/credits_${item.imdbId}.json`;
    if (fs.existsSync(outPath)) {
      skippedCount++;
      continue;
    }

    const url = `https://www.imdb.com/title/${item.imdbId}/fullcredits/`;
    console.log(`[${i + 1}/${titles.length}] Fetching ${item.imdbId} - "${item.title}"...`);
    const data = await scrapeWithFirecrawl(url);
    if (data) {
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      fetchedCount++;
      console.log(`  ✅ Saved ${item.imdbId} ("${item.title}")`);
    } else {
      failedCount++;
      console.error(`  ❌ Failed ${item.imdbId} ("${item.title}")`);
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n🎉 Done! Fetched: ${fetchedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
}

main().catch(console.error);
