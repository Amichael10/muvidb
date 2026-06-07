import * as cheerio from 'cheerio';

const url = 'https://www.partyjolloftv.com/movies/koledowo-1717';
const r = await fetch(url, {
  headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
});
const html = await r.text();
const $ = cheerio.load(html);

// People links
const peopleLinks = [];
$('a[href]').each((_, el) => {
  const href = $(el).attr('href');
  const text = $(el).text().trim();
  if (href && href.includes('/people/')) {
    peopleLinks.push({ href, text });
  }
});
console.log('\n=== PEOPLE LINKS ===');
console.log(JSON.stringify(peopleLinks, null, 2));

// Cast section
const castIdx = html.indexOf('"cast"');
console.log('\n=== JSON cast data ===');
console.log(html.substring(castIdx, castIdx + 800));

// Director
const dirIdx = html.indexOf('"director"');
console.log('\n=== JSON director data ===');
console.log(html.substring(dirIdx, dirIdx + 400));

// Country
const countryIdx = html.indexOf('"country"');
console.log('\n=== JSON country data ===');
console.log(html.substring(countryIdx, countryIdx + 200));

// Check for JSON-LD or __NEXT_DATA__
const nextDataIdx = html.indexOf('__NEXT_DATA__');
console.log('\n=== __NEXT_DATA__ exists:', nextDataIdx > -1);
if (nextDataIdx > -1) {
  console.log(html.substring(nextDataIdx + 30, nextDataIdx + 2000));
}
