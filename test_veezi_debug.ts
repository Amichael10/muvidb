import fs from 'fs';
import { veeziAdapter } from './api/_lib/cinema-adapters/veezi.js';

const html = fs.readFileSync('veezi_html.html', 'utf8');

const filmBlocks = html.split(/<div[^>]+class="[^"]*\bfilm\b[^"]*"[^>]+id="(ST\d+)"/i);

for (let i = 1; i < filmBlocks.length - 1; i += 2) {
  const filmId = filmBlocks[i];
  const block  = filmBlocks[i + 1];

  let titleMatch = block.match(/<h3[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/h3>/i);
  let title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : 'Unknown';

  const dateBlocks = block.split(/<div[^>]+class="[^"]*date-container[^"]*"[^>]*>/i);
  let foundShowtimes = 0;

  for (let j = 1; j < dateBlocks.length; j++) {
    const dateBlock = dateBlocks[j];
    
    let dateMatch = dateBlock.match(/<h4[^>]*class="[^"]*date[^"]*"[^>]*>([\s\S]*?)<\/h4>/i);
    if (!dateMatch) {
      continue;
    }

    const sessionRe = /<a\s+href="\/purchase\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let sessionMatch;
    while ((sessionMatch = sessionRe.exec(dateBlock)) !== null) {
      foundShowtimes++;
    }
  }

  if (foundShowtimes === 0) {
    console.log(`[NO SHOWTIMES] ${title}`);
    console.log(`Block length: ${block.length}`);
  }
}
