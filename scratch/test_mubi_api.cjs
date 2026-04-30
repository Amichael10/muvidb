const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function testApi(country = 'Nigeria', page = 1) {
    // Try api.mubi.com
    const url = `https://api.mubi.com/v1/films?country=${country}&page=${page}`;
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
    console.log('Data keys:', Object.keys(data));
    if (Array.isArray(data)) {
        console.log('Items count:', data.length);
        console.log('Sample item title:', data[0]?.title);
    } else if (data.films) {
        console.log('Films count:', data.films.length);
        console.log('Sample film title:', data.films[0]?.title);
    } else {
        console.log('Unexpected data structure:', data);
    }
}

testApi().catch(console.error);
