const fs = require('fs');
let content = fs.readFileSync('scripts/netflix_sync.ts', 'utf8');

content = content.replace(
  "const NETFLIX_URL = 'https://www.netflix.com/browse/genre/1138254?so=su';",
  "const NETFLIX_URLS = [\n  'https://www.netflix.com/browse/genre/1138254?so=su',\n  'https://www.netflix.com/browse/genre/3761?so=su',\n  'https://www.netflix.com/search?q=Nollywood'\n];"
);

const startStr = "console.log(`🚀 Navigating to: ${NETFLIX_URL}`);";
const endStr = "console.log(`🎬 Found ${movies.length} Nollywood titles on Netflix.`);\n  }";

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr) + endStr.length;

if (startIdx === -1 || endIdx === -1) {
  console.error("Could not find replacement block");
  process.exit(1);
}

const blockToReplace = content.substring(startIdx, endIdx);

const newBlock = `let movies: any[] = [];
  const globalMovieMap = new Map();

  for (const targetUrl of NETFLIX_URLS) {
    console.log(\`\\n🚀 Navigating to: \${targetUrl}\`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

    if (page.url().includes('/login')) {
      console.log('ℹ️ Redirected to login. Starting authentication flow...');
      await login(page);
      await context.storageState({ path: STATE_FILE });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    const profileSelected = await handleProfileSelection(page);
    if (profileSelected) {
      await context.storageState({ path: STATE_FILE });
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    console.log('⌛ Waiting for titles to appear...');
    try {
      await page.waitForSelector('.slider-item, .title-card, [data-testid="title-card"], a.slider-refocus, a[href*="/watch/"], a[data-uia="video-canvas"], .rowContainer, .lolomo', { timeout: 60000 });
    } catch (e) {
      console.warn('⚠️ Timeout waiting for titles.');
      if (page.url().includes('/ProfilesGate') || page.url().includes('/profiles')) {
        await handleProfileSelection(page);
      }
    }

    console.log('📜 Scrolling to load all titles on this page...');
    let lastHeight = await page.evaluate('document.body.scrollHeight');
    for (let i = 0; i < 25; i++) {
      await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      await page.waitForTimeout(2500);
      let newHeight = await page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight) {
        await page.evaluate('window.scrollBy(0, -200)');
        await page.waitForTimeout(1000);
        await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
        await page.waitForTimeout(3000);
        newHeight = await page.evaluate('document.body.scrollHeight');
        if (newHeight === lastHeight) break;
      }
      lastHeight = newHeight;
    }

    const pageMovies = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.lolomoRow, .rowContainer, .slider-item, .galleryLockups'));
      const map = new Map();

      rows.forEach(row => {
        const rowTitle = row.querySelector('.rowTitle, .row-header-title, h2')?.textContent || '';
        const isAfricanRow = /African|Nigerian|Nollywood|South African|Ghanaian|Kenya|Senegal|Egypt|Ethiopia|Cameroon|Morocco|Lagos|Yoruba|Hausa|Igbo|Accra|Nairobi|Dakar|Johannesburg|Soil|Culture|Heritage/i.test(rowTitle);
        const isAlgorithmicRow = /Top Picks|Next Watch|New on Netflix|My List|Trending|Popular|Favorites/i.test(rowTitle) && !isAfricanRow;
        const isOnGenrePage = window.location.href.includes('1138254') || window.location.href.includes('3761');
        
        if (isAlgorithmicRow && !isOnGenrePage) return;
        if (!isAfricanRow && !isOnGenrePage && !window.location.href.includes('search')) return;

        const links = Array.from(row.querySelectorAll('a[href*="/title/"], a[href*="/watch/"], a.slider-refocus, a[data-uia="video-canvas"], a.slider-item-link'));
        
        links.forEach(linkEl => {
          const href = linkEl.getAttribute('href') || '';
          const idMatch = href.match(/\\/(watch|title)\\/(\\d+)/);
          if (!idMatch) return;
          
          const watchId = idMatch[2];
          if (map.has(watchId)) return;

          let titleText = linkEl.getAttribute('aria-label') || linkEl.querySelector('img')?.getAttribute('alt') || linkEl.querySelector('.fallback-text')?.textContent?.trim() || linkEl.textContent?.trim();
          if (titleText) titleText = titleText.replace(/^(Watch|Go to|Play|View)\\s+/i, '').trim();

          if (titleText && titleText !== 'Unknown' && titleText.length > 1) {
            map.set(watchId, {
              title: titleText,
              netflix_id: watchId,
              url: \`https://www.netflix.com/title/\${watchId}\`,
              watch_url: \`https://www.netflix.com/watch/\${watchId}\`,
              poster_url: linkEl.querySelector('img')?.src || null,
              isAfricanDiscovery: isAfricanRow || window.location.href.includes('search')
            });
          }
        });
      });
      return Array.from(map.values());
    });

    console.log(\`🎬 Found \${pageMovies.length} titles on \${targetUrl}\`);
    pageMovies.forEach((m: any) => {
      if (!globalMovieMap.has(m.netflix_id)) {
        globalMovieMap.set(m.netflix_id, m);
      }
    });
  }

  const movies = Array.from(globalMovieMap.values());
  if (movies.length === 0) {
    console.log('📸 Saving debug screenshot...');
    await page.screenshot({ path: 'netflix-debug.png', fullPage: true });
    console.log('⚠️ No titles found across all pages.');
  } else {
    console.log(\`🎬 Found \${movies.length} UNIQUE titles across all Netflix pages.\`);
  }`;

content = content.replace(blockToReplace, newBlock);
fs.writeFileSync('scripts/netflix_sync.ts', content, 'utf8');
console.log('Successfully updated netflix_sync.ts!');
