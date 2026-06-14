const fs = require('fs');
const html = fs.readFileSync('veezi_html.html', 'utf8');

const filmBlocks = html.split(/(?=<div[^>]+class="[^"]*\bfilm\b[^"]*"[^>]*>)/i);
for (let i = 0; i < filmBlocks.length; i++) {
  const block = filmBlocks[i];
  if (!block.match(/class="[^"]*\bfilm\b/i)) continue;
  
  const idMatch = block.match(/id="([^"]*)"/i);
  const filmId = idMatch && idMatch[1] ? idMatch[1] : null;

  const titleMatch = block.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';

  const dateBlocks = block.split(/<div[^>]+class="[^"]*date-container[^"]*"[^>]*>/i);
  let found = 0;
  for (let j = 1; j < dateBlocks.length; j++) {
    if(dateBlocks[j].includes('session-times')) found++;
  }

  console.log(`Title: ${title} | ID: ${filmId} | Dates: ${found}`);
}
