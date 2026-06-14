const html = require('fs').readFileSync('prime_detail_test.html', 'utf8');
const cheerio = require('cheerio');
const $ = cheerio.load(html);

console.log('Title:', $('title').text());
console.log('Meta Description:', $('meta[name="description"]').attr('content'));
console.log('OG Description:', $('meta[property="og:description"]').attr('content'));
console.log('Schema.org:', $('script[type="application/ld+json"]').text().substring(0, 500));
