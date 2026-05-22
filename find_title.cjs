const fs = require('fs');
const html = fs.readFileSync('filmhouse_after_click.html', 'utf8');

const titleMatches = html.match(/class=\"([^\"]*)\"[^>]*>Efunroye/g);
console.log(titleMatches);
