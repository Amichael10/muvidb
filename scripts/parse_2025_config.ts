import fs from 'fs';

const text = fs.readFileSync('outputs/yearbook_2025_config.js', 'utf8');
console.log('2025 Config text length:', text.length);

// Extract text contents or page links
const searchTerms = ['Jenifa', 'Queen', 'Nollywood', 'Hollywood', 'Actor', 'Actress', 'Lead', 'Box Office', 'Gross'];
for (const term of searchTerms) {
  const count = (text.match(new RegExp(term, 'gi')) || []).length;
  console.log(`Term "${term}": ${count} matches`);
}
