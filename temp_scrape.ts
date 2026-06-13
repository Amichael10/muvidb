import * as cheerio from 'cheerio';

async function test() {
  const url = 'https://www.nollydata.com/moviess';
  const res = await fetch(url);
  const html = await res.text();
  const $ = cheerio.load(html);
  
  const links = [];
  $('a').each((i, el) => {
    links.push($(el).attr('href'));
  });
  console.log("Total links:", links.length);
  console.log("First 20 links:", links.slice(0, 20));
  
  // also check if any links contain 'movie'
  const movieLinks = links.filter(l => l && l.includes('movie'));
  console.log("Links containing 'movie':", movieLinks);
}

test();
