const fs = require('fs');
const dotenv = require('dotenv');

const envLocal = fs.existsSync('.env.local') ? dotenv.parse(fs.readFileSync('.env.local')) : {};
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const all = { ...env, ...envLocal };

const keys = [all.FIRECRAWL_API_KEY_2, all.FIRECRAWL_API_KEY_3, all.FIRECRAWL_API_KEY_4].filter(Boolean);
let keyIdx = 0;

const TITLES = [
  { id: 'tt32731790', title: 'School Run', year: 2023 },
  { id: 'tt27627814', title: 'King Mabutu', year: 2023 },
  { id: 'tt21352098', title: 'Andauotu', year: 2021 },
  { id: 'tt10073630', title: 'Kuvana', year: 2019 },
  { id: 'tt17720506', title: 'Black Day', year: 2018 },
  { id: 'tt19115984', title: 'The Hustle Is Real', year: 2018 },
  { id: 'tt26759568', title: 'Fair Lady', year: 2018 },
  { id: 'tt8346640',  title: 'The Plot', year: 2018 },
  { id: 'tt27182312', title: 'Heart Trending', year: 2018 },
  { id: 'tt8368458',  title: 'Next Door', year: 2017 },
  { id: 'tt6783708',  title: '25th Birthday', year: 2016 },
  { id: 'tt8367562',  title: 'Hotel Choco', year: 2016 },
  { id: 'tt40331387', title: 'Rumuokani', year: 2013 }
];

async function scrape(url) {
  const k = keys[keyIdx % keys.length];
  keyIdx++;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'] })
      });
      const json = await res.json();
      if (json.success && json.data) {
        return json.data;
      }
      console.warn(`  Retry ${attempt + 1} for ${url}... (${json.error || 'no data'})`);
    } catch (e) {
      console.warn(`  Attempt ${attempt + 1} error:`, e.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

async function main() {
  console.log(`Starting fetch for ${TITLES.length} Edward Uka titles...`);

  for (let i = 0; i < TITLES.length; i++) {
    const t = TITLES[i];
    console.log(`\n[${i + 1}/${TITLES.length}] ${t.title} (${t.id})...`);

    // 1. Title overview page
    const titleFile = `scratch/title_${t.id}.json`;
    if (!fs.existsSync(titleFile)) {
      console.log(`  Fetching title page: https://www.imdb.com/title/${t.id}/`);
      const data = await scrape(`https://www.imdb.com/title/${t.id}/`);
      if (data) {
        fs.writeFileSync(titleFile, JSON.stringify(data, null, 2));
        console.log(`  ✅ Saved title page`);
      } else {
        console.error(`  ❌ Failed title page for ${t.id}`);
      }
      await new Promise(r => setTimeout(r, 800));
    } else {
      console.log(`  (Title page already exists)`);
    }

    // 2. Full credits page
    const creditsFile = `scratch/credits_${t.id}.json`;
    if (!fs.existsSync(creditsFile)) {
      console.log(`  Fetching fullcredits page: https://www.imdb.com/title/${t.id}/fullcredits/`);
      const data = await scrape(`https://www.imdb.com/title/${t.id}/fullcredits/`);
      if (data) {
        fs.writeFileSync(creditsFile, JSON.stringify(data, null, 2));
        console.log(`  ✅ Saved fullcredits page`);
      } else {
        console.error(`  ❌ Failed fullcredits page for ${t.id}`);
      }
      await new Promise(r => setTimeout(r, 800));
    } else {
      console.log(`  (Credits page already exists)`);
    }
  }

  console.log('\nAll scraping completed!');
}

main().catch(console.error);
