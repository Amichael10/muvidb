import fs from 'fs';
import * as cheerio from 'cheerio';

const html = fs.readFileSync('mubi_dump.html', 'utf-8');
const $ = cheerio.load(html);
const links = [];
$('a').each((i, el) => {
  const href = $(el).attr('href');
  if (href && href.startsWith('/en/films/')) {
     links.push(href);
  }
});
console.log("Found links:", [...new Set(links)]);
