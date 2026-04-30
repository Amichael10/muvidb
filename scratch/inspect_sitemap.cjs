const fs = require('fs');

async function inspectSitemap() {
    const url = 'https://feeds.mubi.com/sitemap/films_0.xml';
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('Total length:', text.length);
        console.log('First 500 chars:', text.substring(0, 500));
        
        // Count all <loc> tags
        const locs = text.match(/<loc>/g);
        console.log('Total <loc> tags:', locs ? locs.length : 0);
        
        // Count unique slugs
        const slugs = new Set();
        const regex = /films\/([^<"\/]+)/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
            slugs.add(match[1]);
        }
        console.log('Unique slugs found:', slugs.size);
        
        // Sample slugs
        console.log('Sample slugs:', Array.from(slugs).slice(0, 10));
    } catch (e) {
        console.error(e);
    }
}

inspectSitemap();
