const cheerio = require('cheerio');
const https = require('https');

const url = 'https://www.ironflix.com/movies';

https.get(url, (res) => {
  let html = '';
  res.on('data', chunk => { html += chunk; });
  res.on('end', () => {
    const $ = cheerio.load(html);
    const movies = [];
    
    $('.card-body').each((i, el) => {
      // this is just a guess based on standard bootstrap/ironflix structure
      // we will refine it. For now, let's just log something.
    });
    
    // Actually, looking at the markdown, they are list items. Let's just find links that look like movies.
    const movieLinks = new Set();
    $('a').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('https://www.ironflix.com/') && !href.includes('/browse') && !href.includes('/login') && !href.includes('/checkout')) {
        movieLinks.add(href);
      }
    });
    
    console.log(`Found ${movieLinks.size} potential movie links.`);
    console.log(Array.from(movieLinks).slice(0, 5));
  });
}).on('error', err => {
  console.error(err);
});
