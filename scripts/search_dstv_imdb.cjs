const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const shows = JSON.parse(fs.readFileSync('scratch/all_dstv_shows_enriched.json'));

async function searchImdb(title) {
  try {
    const res = await fetch(`https://api.firecrawl.dev/v1/scrape`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + all.FIRECRAWL_API_KEY_2, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://www.imdb.com/find/?q=${encodeURIComponent(title)}&s=tt&ttype=tv`,
        formats: ['markdown']
      })
    });
    const json = await res.json();
    if (json.data?.markdown) {
      const match = json.data.markdown.match(/https:\/\/www\.imdb\.com\/title\/(tt\d+)\//);
      return match ? match[1] : null;
    }
  } catch (e) {
    console.error(`Search error for ${title}:`, e.message);
  }
  return null;
}

async function run() {
  for (const s of shows) {
    console.log(`Checking IMDb for "${s.title}"...`);
    const tt = await searchImdb(s.title);
    console.log(`  -> ${s.title}: ${tt || 'Not found on IMDb'}`);
    s.imdb_id = tt;
    await new Promise(r => setTimeout(r, 1000));
  }
  fs.writeFileSync('scratch/all_dstv_shows_with_imdb.json', JSON.stringify(shows, null, 2));
}

run();
