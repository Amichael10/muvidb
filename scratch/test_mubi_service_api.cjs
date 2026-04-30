const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testServiceApi(country = 'Nigeria', page = 1) {
    const url = `https://mubi.com/services/api/films/browse?country=${country}&page=${page}`;
    console.log(`🔍 Fetching ${url}...`);
    
    const response = await fetch(url, {
        headers: { 
            'User-Agent': USER_AGENT,
            'Accept': 'application/json'
        }
    });
    
    if (!response.ok) {
        console.error(`❌ HTTP ${response.status} for ${url}`);
        const text = await response.text();
        console.log('Response:', text.substring(0, 500));
        return;
    }

    const data = await response.json();
    console.log('✅ Success!');
    console.log('Films count:', data.length);
    if (data.length > 0) {
        console.log('Sample film title:', data[0]?.title);
        console.log('Sample film slug:', data[0]?.slug);
    }
}

testServiceApi().catch(console.error);
