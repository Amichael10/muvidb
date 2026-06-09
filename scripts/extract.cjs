const fs = require('fs');
const cheerio = require('cheerio');
const html = fs.readFileSync('mubi_html.html', 'utf8');
const $ = cheerio.load(html);
const data = $('#__NEXT_DATA__').html();
if (data) {
  fs.writeFileSync('mubi_next.json', JSON.stringify(JSON.parse(data), null, 2));
  console.log('Saved');
} else {
  console.log('Not found');
}
