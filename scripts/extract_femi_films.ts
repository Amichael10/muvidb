import fs from 'node:fs';

function extractFemiCredits() {
  const data = JSON.parse(fs.readFileSync('scratch/femi_profile.json'));
  const md = data.markdown || '';

  // Look for titles in the credits section
  const lines = md.split('\n');
  const films: Array<{ title: string; imdbId: string; character: string; year: number | null }> = [];

  let currentTitle = '';
  let currentId = '';
  let currentRole = '';
  let currentYear: number | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Matches markdown link e.g. [Title](https://www.imdb.com/title/tt1234567/...)
    const titleMatch = line.match(/^\[([^\]]+)\]\(https:\/\/www\.imdb\.com\/title\/(tt\d+)\/[^)]*\)$/);
    if (titleMatch) {
      const t = titleMatch[1].trim();
      const id = titleMatch[2];
      // Skip generic UI links
      if (!['Home', 'Release calendar', 'Top 250 movies', 'Most popular movies'].includes(t) && !t.includes('IMDbPro')) {
        currentTitle = t;
        currentId = id;
      }
    }

    if (currentTitle && currentId) {
      const yearMatch = line.match(/\b(19\d\d|20\d\d)\b/);
      if (yearMatch && !currentYear) {
        currentYear = parseInt(yearMatch[1], 10);
      }
      if (line.startsWith('- ') && !line.includes('Completed') && !line.includes('Post-production') && !line.includes('Actor') && !line.includes('IMDb')) {
        const char = line.replace(/^- /, '').trim();
        if (char && char.length < 50) currentRole = char;
      }

      if (currentYear) {
        if (!films.some(f => f.imdbId === currentId)) {
          films.push({
            title: currentTitle,
            imdbId: currentId,
            character: currentRole || null,
            year: currentYear,
          });
        }
        currentTitle = '';
        currentId = '';
        currentRole = '';
        currentYear = null;
      }
    }
  }

  console.log(`Extracted ${films.length} film titles for Femi Branch!`);
  console.log('Sample (first 15):', JSON.stringify(films.slice(0, 15), null, 2));
  fs.writeFileSync('scratch/femi_extracted_films.json', JSON.stringify(films, null, 2));
}

extractFemiCredits();
