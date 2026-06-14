const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('public/e34f3b90-9329-4ab7-8cb3-a9e11fc7a9da.htm', 'utf8');
const $ = cheerio.load(html);

console.log('--- GENRES ---');
$('a[href*="/genre/"]').each((i, el) => {
    console.log($(el).text().trim(), $(el).attr('href'));
});

console.log('--- PEOPLE ---');
$('a[href*="/people/"]').each((i, el) => {
    console.log($(el).text().trim(), $(el).attr('href'));
});

console.log('--- H1 (Title) ---');
console.log($('h1').text().trim());

console.log('--- Meta Description (Synopsis) ---');
console.log($('meta[name="description"]').attr('content'));

console.log('--- Info (Year/Duration) ---');
$('div').each((i, el) => {
    const text = $(el).text().trim();
    if (text.includes('2009') || text.includes('min')) {
        // Just print classes or ids to help us find the selector
        const classes = $(el).attr('class');
        if (classes && classes.includes('flex')) {
             console.log('Potential info wrapper:', classes, $(el).text().substring(0, 50).trim());
        }
    }
});
