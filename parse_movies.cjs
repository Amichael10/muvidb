const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('filmhouse_after_click.html', 'utf8');

const $ = cheerio.load(html);
const movies = [];

// Try finding by the Next.js script payload first
const nextData = $('script#__NEXT_DATA__').html();
if (nextData) {
    console.log("Found __NEXT_DATA__!");
}

// Find all elements with aria-label which is the full title
$('[aria-label]').each((i, el) => {
    const label = $(el).attr('aria-label');
    if (label && $(el).hasClass('heading-style-h5')) {
        movies.push(label);
    }
});

console.log("Titles found by aria-label:", Array.from(new Set(movies)));

// Find all 'h2' or 'h5' that look like titles
const titles2 = [];
$('h2.page-custom-title-2, h5.heading-style-h5').each((i, el) => {
    titles2.push($(el).text().trim());
});

console.log("Titles found by h2/h5:", Array.from(new Set(titles2)));
