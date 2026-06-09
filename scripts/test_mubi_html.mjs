import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as cheerio from 'cheerio';
import fs from 'fs';

const PROXY = "http://smart-n84gqsupfojn:cumaxLcBt96dj0Wp@proxy.smartproxy.net:3120";
const proxyAgent = new HttpsProxyAgent(PROXY);

async function run() {
    console.log("Fetching MUBI HTML...");
    const url = "https://mubi.com/en/films?all_films=true&country=Nigeria&sort=popularity_quality_score";
    try {
        const res = await fetch(url, {
            agent: proxyAgent,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml"
            }
        });
        const text = await res.text();
        const $ = cheerio.load(text);
        
        const nextData = $('#__NEXT_DATA__').html();
        if (nextData) {
            console.log("Found __NEXT_DATA__, length:", nextData.length);
            const data = JSON.parse(nextData);
            fs.writeFileSync('mubi_data.json', JSON.stringify(data, null, 2));
            console.log("Written to mubi_data.json");
        } else {
            console.log("No __NEXT_DATA__ found.");
            console.log("Title:", $('title').text());
        }
    } catch (e) {
        console.error(e);
    }
}
run();
