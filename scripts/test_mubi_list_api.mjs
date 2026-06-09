import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY = "http://smart-n84gqsupfojn:cumaxLcBt96dj0Wp@proxy.smartproxy.net:3120";
const proxyAgent = new HttpsProxyAgent(PROXY);

async function run() {
    console.log("Fetching MUBI v4 API...");
    const url = "https://api.mubi.com/v4/browse/films?country=Nigeria&all_films=true&page=1&per_page=2";
    try {
        const res = await fetch(url, {
            agent: proxyAgent,
            headers: {
                "Client-Country": "NG",
                "client": "web",
                "User-Agent": "Mozilla/5.0",
                "Accept": "application/json"
            }
        });
        const data = await res.json();
        console.log(JSON.stringify(data.films[0], null, 2));
    } catch (e) {
        console.error(e);
    }
}
run();
