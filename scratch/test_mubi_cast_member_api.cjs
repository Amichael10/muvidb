async function testApi(slug) {
    const url = `https://mubi.com/services/api/cast_members/${slug}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const data = await res.json();
        console.log('--- Cast Member ---');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}
testApi('antar-laniyan');
testApi('c-j-fiery-obasi');
