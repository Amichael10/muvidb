const fs = require('fs');
const html = fs.readFileSync('filmhouse_after_click.html', 'utf8');
const cheerio = require('cheerio'); // If available, but we can just use regex.

const matches = html.match(/class="([^"]+)"[^>]*>\s*<[^>]+class="heading-style-h5/g);
console.log('Containers for h5:', matches ? matches.slice(0, 5) : 'None');

const matches2 = html.match(/class="([^"]+)"[^>]*>\s*<[^>]+class="page-custom-title-2/g);
console.log('Containers for title-2:', matches2 ? matches2.slice(0, 5) : 'None');

// Let's find anything that looks like a movie card
const cards = html.match(/class="([^"]*card[^"]*|[^"]*movie[^"]*|[^"]*item[^"]*)"/gi);
if (cards) {
  const uniq = Array.from(new Set(cards)).slice(0, 10);
  console.log('Possible cards:', uniq);
}
