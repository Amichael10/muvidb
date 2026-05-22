import fs from 'fs';
const t = fs.readFileSync('playwright_stealth_dump.html', 'utf8');
const m = t.match(/class=\"[^\"]*dropdown[^\"]*\"/gi);
if (m) console.log(Array.from(new Set(m)).join('\n'));
