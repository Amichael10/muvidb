const cheerio = require('cheerio');
const fs = require('fs');

async function checkTotal() {
    const url = 'https://mubi.com/en/films?all_films=true&sort=popularity_quality_score';
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const scriptContent = $('#__NEXT_DATA__').html();
        if (scriptContent) {
            const data = JSON.parse(scriptContent);
            const totalCount = data.props.pageProps.totalCount;
            const filmsCount = data.props.pageProps.films ? data.props.pageProps.films.length : 0;
            console.log(`Total Films in Database: ${totalCount}`);
            console.log(`Films on first page: ${filmsCount}`);
            
            // Log structure to see where pagination info is
            fs.writeFileSync('mubi_structure.json', JSON.stringify(data.props.pageProps, null, 2));
        } else {
            console.log('NEXT_DATA not found');
        }
    } catch (e) {
        console.error(e);
    }
}

checkTotal();
