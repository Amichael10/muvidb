const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function getBuildId() {
    const url = 'https://mubi.com/en/ng/films';
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
    });
    const html = await response.text();
    const match = html.match(/"buildId":"(.*?)"/);
    return match ? match[1] : null;
}

async function testDetailJson(buildId, slug) {
    // Detail page JSON endpoint
    const url = `https://mubi.com/_next/data/${buildId}/en/films/${slug}.json`;
    console.log(`🚀 Fetching Detail JSON from: ${url}`);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'x-nextjs-data': '1'
        }
    });
    
    if (!response.ok) {
        console.error(`Error: ${response.status}`);
        return;
    }
    
    const data = await response.json();
    console.log('Keys in pageProps:', Object.keys(data.pageProps || {}));
    if (data.pageProps?.initFilm) {
        console.log(`Title: ${data.pageProps.initFilm.title}`);
    }
}

async function run() {
    const buildId = await getBuildId();
    console.log(`Current Build ID: ${buildId}`);
    if (buildId) {
        await testDetailJson(buildId, 'the-lost-okoroshi');
    }
}

run();
