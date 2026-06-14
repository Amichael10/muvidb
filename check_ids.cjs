const fs = require('fs');
const html = fs.readFileSync('veezi_html.html', 'utf8');
const m = html.match(/<div[^>]+class="[^"]*\bfilm\b[^"]*"[^>]*>/ig);
console.log(m ? m.join('\n') : 'No films found');
