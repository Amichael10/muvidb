import fs from 'fs';

async function go() {
  const r = await fetch('https://filmhouseng.com/', {headers: {'User-Agent': 'Mozilla/5.0'}});
  const t = await r.text();
  const match = t.match(/<script id=\"__NEXT_DATA__\" type=\"application\/json\">(.+?)<\/script>/);
  if (match) {
    fs.writeFileSync('filmhouse_next.json', match[1]);
    console.log('Saved to filmhouse_next.json');
  } else {
    console.log('Not found');
  }
}
go();
