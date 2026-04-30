import * as cheerio from 'cheerio';
import fs from 'fs';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchMubi(url: string) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8'
        }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
}

async function probe() {
    const url = `https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score&page=1`;
    const html = await fetchMubi(url);
    const $ = cheerio.load(html);
    const scriptContent = $('#__NEXT_DATA__').html();
    if (!scriptContent) {
        console.log('No __NEXT_DATA__ found');
        return;
    }
    fs.writeFileSync('scratch/mubi_data.json', scriptContent);
    console.log('Data written to scratch/mubi_data.json');
}

probe();
