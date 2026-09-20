const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const keys = [all.FIRECRAWL_API_KEY_2, all.FIRECRAWL_API_KEY_3, all.FIRECRAWL_API_KEY_4].filter(Boolean);
let keyIdx = 0;

const titles = JSON.parse(fs.readFileSync('scratch/all_sola_titles.json'));

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
  console.log(`🎬 Fetching fullcredits for ${titles.length} Sola Kosoko titles...`);
  console.log(`Using ${keys.length} Firecrawl API keys with 3 concurrent workers.`);

  let fetchedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  const pending = [];
  for (let i = 0; i < titles.length; i++) {
    const t = titles[i];
    const tt = t.imdbId;
    const outPath = `scratch/credits_${tt}.json`;
    if (fs.existsSync(outPath)) {
      skippedCount++;
    } else {
      pending.push({ ...t, index: i + 1 });
    }
  }

  console.log(`Found ${skippedCount} cached, ${pending.length} to fetch.`);

  const CONCURRENCY = 3;
  let nextIdx = 0;

  async function worker(workerId) {
    while (nextIdx < pending.length) {
      const item = pending[nextIdx++];
      const url = `https://www.imdb.com/title/${item.imdbId}/fullcredits/`;
      console.log(`[Worker ${workerId}] (${item.index}/${titles.length}) Fetching ${item.imdbId} - "${item.title}"...`);
      const data = await scrapeWithFirecrawl(url);
      if (data) {
        fs.writeFileSync(`scratch/credits_${item.imdbId}.json`, JSON.stringify(data, null, 2));
        fetchedCount++;
        console.log(`  ✅ [Worker ${workerId}] Saved ${item.imdbId} ("${item.title}")`);
      } else {
        failedCount++;
        console.error(`  ❌ [Worker ${workerId}] Failed ${item.imdbId} ("${item.title}")`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }

  const workers = [];
  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(worker(w + 1));
  }

  await Promise.all(workers);

  console.log(`\n🎉 Done! Fetched: ${fetchedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
}

main().catch(console.error);
