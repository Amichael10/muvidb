const cheerio = require('cheerio');

async function testCastPage(slug) {
    const url = `https://mubi.com/en/cast/${slug}`;
    console.log(`Fetching ${url}...`);
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const html = await res.text();
        const $ = cheerio.load(html);
        const scriptContent = $('#__NEXT_DATA__').html();
        if (scriptContent) {
            const nextData = JSON.parse(scriptContent);
            console.log(JSON.stringify(nextData.props.pageProps, null, 2).substring(0, 500));
            // check for images
            const castMember = nextData.props.pageProps.castMember || nextData.props.pageProps.person;
            if (castMember) {
                console.log('--- Cast Member Found ---');
                console.log(castMember);
            }
        }
    } catch (e) {
        console.error('Error:', e);
    }
}
testCastPage('c-j-fiery-obasi');
