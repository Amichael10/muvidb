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

const titles = JSON.parse(fs.readFileSync('scratch/all_femi_titles.json'));

async function scrapeWithFirecrawl(url, key) {
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'] })
      });
      const json = await res.json();
      if (json.success && json.data) return json.data;
      console.warn(`  [Retry ${attempt + 1}] failed:`, json.error || json.message || json);
    } catch (e) {
      console.warn(`  [Err ${attempt + 1}]:`, e.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

async function main() {
  console.log(`🎬 Fetching fullcredits for ${titles.length} Femi Ogedengbe titles...`);

  let fetched = 0;
  let skipped = 0;

  for (let i = 0; i < titles.length; i++) {
    const t = titles[i];
    const tt = t.imdbId;
    const outPath = `scratch/credits_${tt}.json`;

    if (fs.existsSync(outPath)) {
      skipped++;
      continue;
    }

    const key = keys[i % keys.length];
    console.log(`[${i + 1}/${titles.length}] Scraping ${tt} ("${t.title}" ${t.year || ''})...`);
    const data = await scrapeWithFirecrawl(`https://www.imdb.com/title/${tt}/fullcredits/`, key);
    if (data) {
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      fetched++;
      console.log(`  ✅ Saved ${tt} ("${t.title}")`);
    } else {
      console.error(`  ❌ Failed ${tt}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n🎉 Done! Fetched: ${fetched}, Skipped (cached): ${skipped}`);
}

main().catch(console.error);
