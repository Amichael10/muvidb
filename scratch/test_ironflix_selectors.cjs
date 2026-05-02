const cheerio = require('cheerio');
const https = require('https');

const url = 'https://www.ironflix.com/movies';

https.get(url, (res) => {
  let html = '';
  res.on('data', chunk => { html += chunk; });
  res.on('end', () => {
    const $ = cheerio.load(html);
    const movies = [];
    
    // Looks like each movie might be inside an article or div. 
    // Let's find links to movies first
    $('a[href^="https://www.ironflix.com/"]').each((i, el) => {
      const href = $(el).attr('href');
      // If it's a movie page
      if (href && !href.includes('/browse') && !href.includes('/login') && !href.includes('/checkout') && !href.includes('/search')) {
        // Let's find the parent container to get image and text
        const container = $(el).parent();
        const text = container.text().replace(/\s+/g, ' ').trim();
        const img = container.find('img').attr('src');
        movies.push({ href, text: text.substring(0, 100), img });
      }
    });
    
    // Maybe they use a specific class for the movie cards
    console.log("Found movies by looking at links:", movies.slice(0, 3));
    
    // Let's try to find a more specific selector.
    // What classes do images have?
    const imgClasses = [];
    $('img').each((i, el) => {
      imgClasses.push($(el).attr('class'));
    });
    console.log("Image classes on page:", [...new Set(imgClasses)]);
  });
}).on('error', err => {
  console.error(err);
});
