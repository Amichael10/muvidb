const fs = require('fs');

const titles = JSON.parse(fs.readFileSync('scratch/all_zynnell_titles.json'));

const clean = titles.filter(t => {
  const normTitle = t.title.replace(/\\/g, '').trim();
  if (normTitle.startsWith('Episode #')) return false;
  if (normTitle.includes('5TH NAFCA: African Oscar')) return false;
  return true;
});

// Also make sure titles are cleaned of markdown escapes like "Single Six" or "Teni's Big Day"
clean.forEach((t, i) => {
  t.cleanTitle = t.title.replace(/\\/g, '').trim();
  t.cleanIndex = i + 1;
});

console.log(`Clean titles count: ${clean.length}`);
clean.forEach(t => {
  console.log(`${t.cleanIndex}. [${t.imdbId}] "${t.cleanTitle}" (${t.year || 'N/A'}) - ${t.titleType} | Poster: ${t.posterUrl ? 'YES' : 'NONE'}`);
});

fs.writeFileSync('scratch/zynnell_clean_titles.json', JSON.stringify(clean, null, 2));
console.log('Saved to scratch/zynnell_clean_titles.json');
