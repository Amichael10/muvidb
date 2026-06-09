import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const PROXY = "http://smart-n84gqsupfojn:cumaxLcBt96dj0Wp@proxy.smartproxy.net:3120";
const proxyAgent = new HttpsProxyAgent(PROXY);

async function testApi() {
    console.log("Fetching API...");
    try {
        const urlsToTest = [
            "https://api.mubi.com/v3/films?filter[country]=Nigeria",
            "https://api.mubi.com/v3/films?country=NG",
            "https://api.mubi.com/v3/films?countries=Nigeria",
            "https://api.mubi.com/v3/films?historic_countries=Nigeria",
            "https://api.mubi.com/v3/films?country=Nigeria"
        ];
        for (let url of urlsToTest) {
            console.log("Testing URL:", url);
            const res = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Accept": "application/json",
                    "Client-Accept": "application/vnd.mubi.v3+json",
                    "Client": "web",
                    "Client-Country": "NG"
                }
            });
            const data = await res.json();
            console.log("Total count:", data.meta?.total_count);
            console.log("Titles:", data.films?.slice(0,3).map(f => f.title));
            console.log("-------------------");
        }
    } catch (err) {
        console.error(err);
    }
}

testApi();
