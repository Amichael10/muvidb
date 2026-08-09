import fs from 'fs';

const text = fs.readFileSync('outputs/yearbook_2025_config.js', 'utf8');
const jsonText = text.replace(/^var\s+htmlConfig\s*=\s*/, '').replace(/;\s*$/, '');
const config = JSON.parse(jsonText);

console.log('fliphtml5_pages type:', typeof config.fliphtml5_pages);
if (Array.isArray(config.fliphtml5_pages)) {
  console.log('Total pages in fliphtml5_pages:', config.fliphtml5_pages.length);
  console.log('Sample page 1:', config.fliphtml5_pages[0]);
  console.log('Sample page 40:', config.fliphtml5_pages[39]);
  console.log('Sample page 81:', config.fliphtml5_pages[80]);
} else {
  console.log('fliphtml5_pages content preview:', String(config.fliphtml5_pages).slice(0, 500));
}
