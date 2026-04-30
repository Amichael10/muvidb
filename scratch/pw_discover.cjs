const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);
const fs = require('fs');

const STATE_FILE = 'mubi_sync_state.json';
const { AFRICAN_COUNTRIES } = require('../constants.cjs');

function loadState() {
    if (fs.existsSync(STATE_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        } catch (e) {
            console.error('Error loading state:', e);
        }
    }
    return { processed_slugs: [], pending_slugs: [], last_page: 0, country: 'Nigeria' };
}

function saveState(state) {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function main() {
    console.log('🚀 Starting Playwright Discovery (Stealth Mode)...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    
    const state = loadState();
    
    // We will just do a few priority countries to populate the queue for the user quickly,
    // starting with Nigeria.
    const targetCountries = ['Nigeria', 'Senegal', 'Algeria', 'Cameroon', 'Morocco', 'South Africa'];

    for (const country of targetCountries) {
        console.log(`\n--- 🔍 Discovering: ${country} ---`);
        let page = 1;
        while (true) {
            const url = `https://mubi.com/en/films?all_films=true&country=${encodeURIComponent(country)}&sort=popularity_quality_score&page=${page}`;
            console.log(`  -> Page ${page}: ${url}`);
            
            const pageObj = await context.newPage();
            await pageObj.goto(url, { waitUntil: 'domcontentloaded' });
            
            // Extract the Next.js data
            const nextDataText = await pageObj.evaluate(() => {
                const el = document.getElementById('__NEXT_DATA__');
                return el ? el.textContent : null;
            });
            
            await pageObj.close();
            
            if (!nextDataText) {
                console.log(`    ❌ No __NEXT_DATA__ found (Blocked or Empty)`);
                break;
            }
            
            const nextData = JSON.parse(nextDataText);
            const films = nextData.props.pageProps.films || [];
            
            if (films.length === 0) {
                console.log(`    ✅ Reached end of catalog for ${country}`);
                break;
            }
            
            let added = 0;
            for (const film of films) {
                if (!state.processed_slugs.includes(film.slug) && !state.pending_slugs.includes(film.slug)) {
                    state.pending_slugs.push(film.slug);
                    added++;
                }
            }
            console.log(`    ✅ Found ${films.length} films (${added} new). Queue size: ${state.pending_slugs.length}`);
            saveState(state);
            page++;
            
            // Politeness delay
            await new Promise(r => setTimeout(r, 1500));
        }
    }

    await browser.close();
    console.log(`\n🎉 Discovery complete! Run node sync_mubi.cjs to process the ${state.pending_slugs.length} pending films.`);
}

main().catch(console.error);
