import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function test() {
  console.log('Fetching Kava...');
  try {
    const res = await fetch('https://kava.tv/category/p1', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    const movies = [];
    $('.dataContents').each((i, el) => {
      const title = $(el).find('span').text().trim();
      const synopsis = $(el).find('div').text().trim();
      const slug = $(el).closest('a').attr('href')?.split('/').pop() || '';
      
      if (title) {
        movies.push({ title, synopsis, slug });
      }
    });

    console.log('Found:', movies.length);
    console.log('First 2:', JSON.stringify(movies.slice(0, 2), null, 2));
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
