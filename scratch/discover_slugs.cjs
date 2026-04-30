const cheerio = require('cheerio');

async function findSlugs(query) {
    const url = `https://mubi.com/en/search/results?query=${encodeURIComponent(query)}`;
    console.log(`Searching: ${url}`);
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const slugs = new Set();
    
    // Links like /en/films/slug
    $('a[href^="/en/films/"]').each((i, el) => {
        const href = $(el).attr('href');
        const slug = href.split('/').pop();
        if (slug && slug !== 'films') {
            slugs.add(slug);
        }
    });

    // Also check __NEXT_DATA__
    const scriptContent = $('#__NEXT_DATA__').html();
    if (scriptContent) {
        try {
            const data = JSON.parse(scriptContent);
            // Search results might be in different places in NEXT_DATA
            // We'll just stringify and regex if needed, or look deep
            const str = JSON.stringify(data);
            const matches = str.match(/"slug":"([^"]+)"/g);
            if (matches) {
                matches.forEach(m => {
                    const slug = m.split(':')[1].replace(/"/g, '');
                    slugs.add(slug);
                });
            }
        } catch (e) {}
    }

    return Array.from(slugs);
}

async function main() {
    const queries = ['Nigeria', 'Nollywood', 'Lagos'];
    const allSlugs = new Set();
    for (const q of queries) {
        const slugs = await findSlugs(q);
        slugs.forEach(s => allSlugs.add(s));
        console.log(`Found ${slugs.length} slugs for ${q}`);
    }
    console.log('\nAll unique slugs:');
    console.log(JSON.stringify(Array.from(allSlugs), null, 2));
}

main();
