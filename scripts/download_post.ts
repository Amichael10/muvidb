import fs from 'fs';
import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

async function downloadPost() {
  const url = "https://www.itsawrapng.com/post/aba-blues-a-beautiful-idea-lost-in-execution";
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  });
  const html = await res.text();
  fs.writeFileSync('C:\\Users\\User\\.gemini\\antigravity\\brain\\3608c7a3-6ac6-40c8-9e37-f3bc44e75f57\\scratch\\aba_blues.html', html, 'utf8');
  console.log(`Saved aba_blues.html! Length: ${html.length}`);
}

downloadPost().then(() => process.exit(0)).catch(console.error);
