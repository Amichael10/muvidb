const fs = require('fs');
async function testCastPage(slug) {
    const url = `https://mubi.com/en/cast/${slug}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = await res.text();
        fs.writeFileSync('scratch/cast_html.html', html);
        console.log('Saved to scratch/cast_html.html');
    } catch (e) {
        console.error('Error:', e);
    }
}
testCastPage('c-j-fiery-obasi');
