const cheerio = require('cheerio');
const fs = require('fs');

async function explore() {
    const slug = 'mami-wata';
    const url = `https://mubi.com/en/films/${slug}`;
    console.log(`Fetching ${url}...`);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const scriptContent = $('#__NEXT_DATA__').html();
    if (scriptContent) {
        const data = JSON.parse(scriptContent);
        // Save it to a file for inspection
        fs.writeFileSync('mubi_inspect.json', JSON.stringify(data.props.pageProps, null, 2));
        console.log('Saved data to mubi_inspect.json');
        
        // Look for similar films
        const film = data.props.pageProps.film;
        console.log('Film:', film.title);
        
        // NextData structure usually has a lot of info
        if (data.props.pageProps.recommendations) {
            console.log('Recommendations found:', data.props.pageProps.recommendations.length);
        }
    } else {
        console.log('__NEXT_DATA__ not found');
    }
}

explore().catch(console.error);
