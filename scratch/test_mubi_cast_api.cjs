async function testApi(slug) {
    const url = `https://mubi.com/services/api/films/${slug}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const data = await res.json();
        console.log('--- Cast ---');
        console.log(JSON.stringify(data.cast?.[0], null, 2));
        console.log('--- Directors ---');
        console.log(JSON.stringify(data.directors?.[0], null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}
testApi('mami-wata');
