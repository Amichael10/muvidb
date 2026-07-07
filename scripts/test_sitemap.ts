import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function run() {
  try {
    const res = await fetch('https://kava.tv/sitemap.xml');
    const xml = await res.text();
    const sitemapDoc = cheerio.load(xml, { xmlMode: true });
    const urls = sitemapDoc('loc').map((_, el) => sitemapDoc(el).text()).get()
      .filter((u: string) => u.includes('/content/'));
    
    console.log('Total content URLs in sitemap:', urls.length);
    console.log(urls.join('\n'));
  } catch (e) {
    console.error(e);
  }
}

run();
