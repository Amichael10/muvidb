import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';

const proxies = [
  "http://sp1j6x1qnt:G741N3s54rP2P3p20o@gate.smartproxy.com:7000",
  "http://smart-n84gqsupfojn:cumaxLcBt96dj0Wp@gate.smartproxy.com:7000",
  "http://smart-n84gqsupfojn:cumaxLcBt96dj0Wp@proxy.smartproxy.net:3120"
];

async function testProxies() {
  for (const proxy of proxies) {
    console.log("Testing:", proxy);
    try {
      const agent = new HttpsProxyAgent(proxy);
      const res = await fetch("https://httpbin.org/ip", { agent, timeout: 10000 });
      if (res.ok) {
        const data = await res.json();
        console.log("SUCCESS:", data.origin);
      } else {
        console.log("FAILED with status:", res.status);
      }
    } catch (e) {
      console.log("ERROR:", e.message);
    }
    console.log("-----------------------");
  }
}

testProxies();
