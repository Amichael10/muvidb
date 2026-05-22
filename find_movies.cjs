const fs = require('fs');
const html = fs.readFileSync('playwright_stealth_dump.html', 'utf8');
const apis = html.match(/https?:\/\/api[^\s\"\']+/gi);
console.log(apis ? Array.from(new Set(apis)) : 'No API found');

const movieTitles = html.match(/"title":"([^"]+)"/g);
console.log('Found titles?', movieTitles ? movieTitles.slice(0, 5) : 'No');
