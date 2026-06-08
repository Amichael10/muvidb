import * as cheerio from 'cheerio';

const PROXY_USER = 'smart-n84gqsupfojn';
const PROXY_PASS = 'cumaxLcBt96dj0Wp';
const proxyAuth = Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64');

async function test() {
  const url = 'https://www.partyjolloftv.com/movies/divine-lies';
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Proxy-Authorization': `Basic ${proxyAuth}`,
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    
    console.log('--- Links containing /people/ ---');
    $('a[href*="/people/"]').each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      const parentText = $(el).parent().text().trim().replace(/\s+/g, ' ');
      console.log(`Href: ${href} | Text: ${text}`);
      console.log(`Parent Text: ${parentText.substring(0, 200)}`);
      console.log('------------------');
    });
  } catch (err) {
    console.error(err);
  }
}

test();
