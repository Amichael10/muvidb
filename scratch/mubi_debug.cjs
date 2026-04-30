const cheerio = require('cheerio');

async function debugDiscovery() {
    const url = `https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score&page=1`;
    console.log(`\n🔍 Debugging Discovery: ${url}...`);
    
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const scriptContent = $('#__NEXT_DATA__').html();
    if (!scriptContent) {
        console.error('❌ No __NEXT_DATA__ found');
        return;
    }

    const nextData = JSON.parse(scriptContent);
    const props = nextData.props.pageProps;
    
    console.log('Available keys in pageProps:', Object.keys(props));
    
    // Check common list keys
    ['films', 'items', 'data', 'initFilms', 'results'].forEach(k => {
        if (props[k]) {
            console.log(`Key found: ${k} (count: ${props[k].length || 'N/A'})`);
        }
    });

    if (props.dehydratedState) {
        console.log('Dehydrated state found. Checking queries...');
        props.dehydratedState.queries.forEach((q, i) => {
            console.log(`Query ${i}: ${q.queryKey[0]} (count: ${q.state.data?.pages?.[0]?.films?.length || 'N/A'})`);
        });
    }
}

debugDiscovery();
