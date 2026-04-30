const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function discover(country = 'Nigeria', page = 1) {
    const url = `https://mubi.com/en/films?all_films=true&country=${country}&sort=popularity_quality_score&page=${page}`;
    console.log(`🔍 Discovering films on page ${page} for ${country}...`);
    
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const scriptContent = $('#__NEXT_DATA__').html();
    if (!scriptContent) {
        console.error('❌ No __NEXT_DATA__ found');
        return;
    }

    const nextData = JSON.parse(scriptContent);
    const films = nextData.props.pageProps.films || [];
    
    console.log(`Found ${films.length} films.`);
    films.slice(0, 10).forEach(f => {
        console.log(`- ${f.title} (${f.slug})`);
    });
}

discover().catch(console.error);
