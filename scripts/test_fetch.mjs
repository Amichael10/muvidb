import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as cheerio from 'cheerio';

const proxyAuth = Buffer.from('sp1j6x1qnt:G741N3s54rP2P3p20o').toString('base64');
const agent = new HttpsProxyAgent({ host: 'gate.smartproxy.com', port: 7000, headers: { 'Proxy-Authorization': 'Basic ' + proxyAuth } });

async function run() {
  const r = await fetch('https://www.partyjolloftv.com/movies/the-healing-rhythm-8244', { agent });
  const html = await r.text();
  const $ = cheerio.load(html);
  const genres = $('a[href*="/genres/"]').map((_, el) => $(el).text().trim()).get();
  console.log('Genres Array:', genres);
}
run();
