const fs = require('fs');
const html = fs.readFileSync('filmhouse_after_click.html', 'utf8');
const links = html.match(/href="([^"]*movies[^"]*)"/g);
console.log(links ? Array.from(new Set(links)).slice(0, 10) : 'None');
