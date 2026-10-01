import fs from 'node:fs';

function findCast() {
  const credits = JSON.parse(fs.readFileSync('scratch/remi_credits.json', 'utf-8'));
  const title = JSON.parse(fs.readFileSync('scratch/remi_title.json', 'utf-8'));

  console.log('--- CREDITS MARKDOWN ---');
  // Print lines that mention Bisola, Liz, or Cast
  const lines = (credits.markdown || '').split('\n');
  let print = false;
  let printed = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/cast|director|writer|producer|crew|bisola|efejuku/i.test(l)) {
      console.log(`Line ${i}: ${l}`);
      printed++;
      if (printed > 60) break;
    }
  }

  // Check __NEXT_DATA__ in html
  const match = credits.html?.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (match) {
    console.log('Found __NEXT_DATA__ in credits HTML!');
    const nextData = JSON.parse(match[1]);
    fs.writeFileSync('scratch/remi_next_data.json', JSON.stringify(nextData, null, 2));
    console.log('Saved scratch/remi_next_data.json');
  } else {
    console.log('No __NEXT_DATA__ in credits HTML, searching title HTML...');
    const tMatch = title.html?.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (tMatch) {
      console.log('Found __NEXT_DATA__ in title HTML!');
      const nextData = JSON.parse(tMatch[1]);
      fs.writeFileSync('scratch/remi_next_data.json', JSON.stringify(nextData, null, 2));
      console.log('Saved scratch/remi_next_data.json from title');
    }
  }
}

findCast();
