const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testJson(buildId, slug) {
    const url = `https://mubi.com/_next/data/${buildId}/en/films/${slug}/cast.json`;
    console.log(`🔍 Fetching ${url}...`);
    
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
    });
    const data = await response.json();
    
    const fs = require('fs');
    fs.writeFileSync('mubi_cast_json.json', JSON.stringify(data, null, 2));
    console.log('✅ Wrote JSON to mubi_cast_json.json');
    
    const credits = data.pageProps.credits;
    console.log('Credits count:', credits?.length);
    if (credits?.length > 0) {
        console.log('Sample credit:', credits[0]);
    }
}

const buildId = '2026.04.29.0929-a5f928b';
const slug = 'mami-wata';
testJson(buildId, slug).catch(console.error);
