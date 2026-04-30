const cheerio = require('cheerio');

async function inspectCast(slug) {
    const url = `https://mubi.com/en/films/${slug}`;
    console.log(`Inspecting ${url}...`);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    const scriptContent = $('#__NEXT_DATA__').html();
    if (scriptContent) {
        const nextData = JSON.parse(scriptContent);
        // Sometimes it's initFilm, sometimes it's just film
        const film = nextData.props.pageProps.initFilm || nextData.props.pageProps.film;
        if (film) {
            console.log('--- Directors ---');
            console.log(JSON.stringify(film.directors?.[0], null, 2));
            console.log('--- Cast Members ---');
            console.log(JSON.stringify(film.cast_members?.[0], null, 2));
        } else {
            console.log('Film not found in pageProps');
        }
    }
}

inspectCast('mami-wata');
