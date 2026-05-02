const cheerio = require('cheerio');
const https = require('https');

const url = 'https://www.ironflix.com/movies';

https.get(url, (res) => {
  let html = '';
  res.on('data', chunk => { html += chunk; });
  res.on('end', () => {
    const $ = cheerio.load(html);
    
    // Find the first link that has an image
    let containerHTML = '';
    $('a[href^="https://www.ironflix.com/"]').each((i, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('the-marriage-counsellor') && $(el).find('img').length > 0) {
        // Look up the DOM tree for a container, e.g. parent of parent
        containerHTML = $(el).parent().parent().html();
        return false; // break
      }
    });
    
    console.log(containerHTML);
  });
});
