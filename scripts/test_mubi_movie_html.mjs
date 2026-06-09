import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import * as cheerio from 'cheerio';
import fs from 'fs';

const PROXY = "http://smart-n84gqsupfojn:cumaxLcBt96dj0Wp@proxy.smartproxy.net:3120";
const proxyAgent = new HttpsProxyAgent(PROXY);

async function run() {
    console.log("Fetching MUBI Movie HTML...");
    const url = "https://mubi.com/films/between-us-a-secret";
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
            console.log("Found __NEXT_DATA__");
            const data = JSON.parse(nextData);
            fs.writeFileSync('mubi_movie_data.json', JSON.stringify(data, null, 2));
            console.log("Written to mubi_movie_data.json");
            
            // Replicate what the scraper does:
            const film = data.props?.pageProps?.film;
            if (film) {
                console.log("Found film object in pageProps");
            } else {
                console.log("Keys in pageProps:", Object.keys(data.props?.pageProps || {}));
                if (data.props?.pageProps?.initialState) {
                    console.log("Keys in initialState:", Object.keys(data.props.pageProps.initialState));
                    if (data.props.pageProps.initialState.film) {
                        console.log("Film found in initialState.film!");
                    }
                }
            }
        } else {
            console.log("No __NEXT_DATA__ found.");
        }
    } catch (e) {
        console.error(e);
    }
}
run();
