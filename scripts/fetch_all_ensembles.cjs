const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const keys = [all.FIRECRAWL_API_KEY_2, all.FIRECRAWL_API_KEY_3, all.FIRECRAWL_API_KEY_4].filter(Boolean);
let keyIdx = 0;

const titlesObj = JSON.parse(fs.readFileSync('scratch/all_titles_to_fetch.json'));
const titleIds = Object.keys(titlesObj);

async function scrapeWithFirecrawl(url) {
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
    if (!json.success || !json.data) {
      console.error(`[Error] Failed scraping ${url} with key ...${k.slice(-6)}:`, json.error || json);
      return null;
    }
    return json.data;
  } catch (e) {
    console.error(`[Fetch Error] ${url}:`, e.message);
    return null;
  }
}

async function main() {
  console.log(`🎬 Fetching fullcredits for ${titleIds.length} Nollywood titles...`);
  
  let fetchedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < titleIds.length; i++) {
    const tt = titleIds[i];
    const info = titlesObj[tt];
    const outPath = `scratch/credits_${tt}.json`;

    // Check if we already have it from earlier tests or previous runs
    if (tt === 'tt38786160' && fs.existsSync('scratch/mosebolatan_credits.json') && !fs.existsSync(outPath)) {
      fs.copyFileSync('scratch/mosebolatan_credits.json', outPath);
    }
    if (tt === 'tt13584596' && fs.existsSync('scratch/kadara_credits.json') && !fs.existsSync(outPath)) {
      fs.copyFileSync('scratch/kadara_credits.json', outPath);
    }

    if (fs.existsSync(outPath)) {
      skippedCount++;
      continue;
    }

    console.log(`[${i + 1}/${titleIds.length}] Scraping ${tt} ("${info.title}")...`);
    const data = await scrapeWithFirecrawl(`https://www.imdb.com/title/${tt}/fullcredits/`);
    if (data) {
      fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
      fetchedCount++;
      console.log(`  ✅ Saved ${tt} to ${outPath}`);
    } else {
      console.warn(`  ⚠️ Failed to fetch ${tt}`);
    }

    // Gentle pacing to prevent rate limits
    await new Promise(r => setTimeout(r, 1200));
  }

  console.log(`🎉 Ingestion complete! Fetched: ${fetchedCount}, Skipped (already cached): ${skippedCount}`);
}

main();
