const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const STATE_FILE = 'mubi_sync_state.json';

async function fetchWithTimeout(url, timeout = 30000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

async function populateQueue() {
    console.log('🚀 Populating Mubi Scraping Queue from Sitemaps...');
    
    // Load current state
    let state = { processed_slugs: [], pending_slugs: [], last_page: 0, country: 'All' };
    if (fs.existsSync(STATE_FILE)) {
        state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }

    // List of sitemaps
    const sitemaps = [];
    for (let i = 0; i <= 14; i++) {
        sitemaps.push(`https://feeds.mubi.com/sitemap/films_${i}.xml`);
    }

    const processedSlugsSet = new Set(state.processed_slugs);
    const pendingSlugsSet = new Set(state.pending_slugs);

    for (const sitemapUrl of sitemaps) {
        console.log(`\n📄 Processing sitemap: ${sitemapUrl}`);
        try {
            const res = await fetchWithTimeout(sitemapUrl, 60000);
            if (!res.ok) {
                console.error(`  ❌ Failed to fetch sitemap: ${res.status}`);
                continue;
            }
            const xml = await res.text();
            
            // Extract slugs using regex for speed on large XML
            // Format: <loc>https://mubi.com/en/films/slug</loc> or <loc>https://mubi.com/en/ng/films/slug</loc>
            const regex = /<loc>https:\/\/mubi\.com\/(?:[a-z]{2}\/)?(?:[a-z]{2}\/)?films\/([^<]+)<\/loc>/g;
            let match;
            let count = 0;
            let newCount = 0;

            while ((match = regex.exec(xml)) !== null) {
                const slug = match[1];
                count++;
                if (!processedSlugsSet.has(slug) && !pendingSlugsSet.has(slug)) {
                    state.pending_slugs.push(slug);
                    pendingSlugsSet.add(slug);
                    newCount++;
                }
            }

            console.log(`  ✅ Found ${count} films. Added ${newCount} new films to queue.`);
            
            // Save state after each sitemap to avoid data loss
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            
        } catch (e) {
            console.error(`  ❌ Error processing sitemap ${sitemapUrl}: ${e.message}`);
        }
    }

    console.log(`\n🎉 Queue population complete! Total pending: ${state.pending_slugs.length}`);
}

populateQueue().catch(console.error);
