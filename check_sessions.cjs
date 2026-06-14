const fs = require('fs');
const html = fs.readFileSync('veezi_html.html', 'utf8');
const filmBlocks = html.split(/<div[^>]+class="[^"]*\bfilm\b[^"]*"[^>]+id="(ST\d+)"/i);
for (let i = 1; i < filmBlocks.length - 1; i += 2) {
  const block = filmBlocks[i + 1];
  const titleMatch = block.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';
  const dateBlocks = block.split(/<div[^>]+class="[^"]*date-container[^"]*"[^>]*>/i);
  let found = 0;
  for (let j = 1; j < dateBlocks.length; j++) {
    if(dateBlocks[j].includes('session-times')) found++;
  }
  if(found === 0) {
    console.log('NO SESSIONS:', title);
  } else {
    console.log('SESSIONS:', title, found);
  }
}
