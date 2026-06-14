const html = require('fs').readFileSync('prime_detail_test.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log('1.', $('.synopsis-FWBzLL').text());
console.log('2.', $('[data-automation-id="description-text"]').text());
console.log('3.', $('[data-testid="synopsis"]').text());
console.log('4.', $('#pv-details-description').text());
console.log('5.', $('.pv-description').text());
console.log('6.', $('[data-automation-id="synopsis"]').text());
console.log('7.', $('[dir="auto"]').filter((i, el) => $(el).text().length > 100 && $(el).text().length < 1000).first().text());

const fallback = $('div').filter((i, el) => {
    const text = $(el).text();
    return text.length > 50 && text.length < 500 && !text.includes('Related') && !text.includes('Amazon');
}).map((i, el) => $(el).text()).get().slice(0, 5);

console.log('Fallback:', fallback);
