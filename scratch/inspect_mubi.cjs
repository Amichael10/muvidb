const cheerio = require('cheerio');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function inspectMubi(slug) {
    const url = `https://mubi.com/en/films/${slug}`;
    console.log(`🔍 Fetching ${url}...`);
    
    const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const nextData = JSON.parse($('#__NEXT_DATA__').html());
    
    // Write to a temporary file to inspect
    const fs = require('fs');
    fs.writeFileSync('mubi_inspect.json', JSON.stringify(nextData, null, 2));
    console.log('✅ Wrote __NEXT_DATA__ to mubi_inspect.json');
    
    const film = nextData.props.pageProps.initFilm;
    console.log('Film keys:', Object.keys(film));
    if (film.credits) {
        console.log('Found credits in initFilm!');
    } else {
        console.log('No credits in initFilm.');
    }
}

const slug = process.argv[2] || 'eyimofe-this-is-my-desire';
inspectMubi(slug).catch(console.error);
