import fs from 'fs';

const text = fs.readFileSync('outputs/yearbook_2025_config.js', 'utf8');

// Find all matches of files/large/ or files/mobile/ or webp/jpg
const regex = /files\/(large|mobile|thumb)\/[a-zA-Z0-9_-]+\.(jpg|webp|png)/g;
const matches = Array.from(text.matchAll(regex)).map(m => m[0]);

console.log(`Found ${matches.length} total page image files!`);
console.log('First 10 page images:', matches.slice(0, 10));
