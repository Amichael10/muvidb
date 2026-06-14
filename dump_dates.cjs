const fs = require('fs');
const html = fs.readFileSync('veezi_html.html', 'utf8');
const m = html.match(/<h4[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/h4>/ig);
console.log(m ? m.map(s => s.replace(/<[^>]+>/g, '').trim()) : 'None');
