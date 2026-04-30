const fs = require('fs');
const path = require('path');

const filePath = 'scratch/mubi_nigeria.html';
if (!fs.existsSync(filePath)) {
    console.log('File not found');
    process.exit(1);
}

const html = fs.readFileSync(filePath, 'utf8');
const regex = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;
const match = html.match(regex);

if (match) {
    try {
        const data = JSON.parse(match[1]);
        const films = data.props.pageProps.films || [];
        console.log(`Found ${films.length} films.`);
        console.log(JSON.stringify(films.slice(0, 5).map(f => ({
            id: f.id,
            title: f.title,
            slug: f.slug,
            year: f.year
        })), null, 2));
    } catch (e) {
        console.error('Error parsing JSON:', e.message);
    }
} else {
    console.log('__NEXT_DATA__ not found in HTML');
}
