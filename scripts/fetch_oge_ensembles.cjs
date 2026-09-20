const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const keys = [all.FIRECRAWL_API_KEY_2, all.FIRECRAWL_API_KEY_3, all.FIRECRAWL_API_KEY_4].filter(Boolean);
if (keys.length === 0) {
  console.error('No Firecrawl API keys found!');
  process.exit(1);
}

let keyIdx = 0;
const titles = JSON.parse(fs.readFileSync('scratch/all_oge_titles.json'));

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
  console.log(`🎬 Fetching fullcredits for ${titles.length} Oge Okoye titles...`);
  console.log(`Using ${keys.length} Firecrawl API keys with 3 concurrent workers.`);

  let fetchedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  // Filter items that need fetching
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

  console.log(`Already cached: ${skippedCount}, Remaining to fetch: ${pending.length}`);

  let currentIndex = 0;

  async function worker(workerId) {
    const key = keys[workerId % keys.length];
    while (currentIndex < pending.length) {
      const idx = currentIndex++;
      const item = pending[idx];
      const tt = item.imdbId;
      const outPath = `scratch/credits_${tt}.json`;

      console.log(`[Worker ${workerId + 1} | ${idx + 1}/${pending.length}] Scraping ${tt} ("${item.title}" ${item.year || ''})...`);
      
      let data = null;
      for (let attempt = 0; attempt <= 2; attempt++) {
        try {
          const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: `https://www.imdb.com/title/${tt}/fullcredits/`, formats: ['markdown'] })
          });
          const json = await res.json();
          if (json.success && json.data) {
            data = json.data;
            break;
          }
          console.warn(`  [W${workerId + 1} retry ${attempt + 1}] failed for ${tt}:`, json.error || json.message || json);
        } catch (e) {
          console.warn(`  [W${workerId + 1} err ${attempt + 1}] for ${tt}:`, e.message);
        }
        await new Promise(r => setTimeout(r, 1200));
      }

      if (data) {
        fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
        fetchedCount++;
        console.log(`  ✅ [W${workerId + 1}] Saved ${tt} ("${item.title}") [Total saved: ${fetchedCount}]`);
      } else {
        failedCount++;
        console.error(`  ❌ [W${workerId + 1}] Failed to fetch ${tt}`);
      }

      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const workers = [];
  const concurrency = Math.min(3, keys.length);
  for (let w = 0; w < concurrency; w++) {
    workers.push(worker(w));
  }
  await Promise.all(workers);

  console.log(`\n🎉 Fetch complete! Fetched: ${fetchedCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);
}

main().catch(console.error);
