import fs from 'fs';

async function scan() {
  const t = fs.readFileSync('filmhouse_dump.html', 'utf8');
  const chunks = Array.from(new Set(t.match(/\/_next\/static\/chunks\/[a-zA-Z0-9\-\.\_]+\.js/g)));
  const apis = new Set();
  
  for(const chunk of chunks) {
    const url = 'https://filmhouseng.com' + chunk;
    try {
      const r = await fetch(url);
      const text = await r.text();
      const urls = text.match(/https?:\/\/[a-zA-Z0-9\-\.\_]+\/[a-zA-Z0-9\-\.\/\_\?\=\&]+/g);
      if(urls) {
        urls.forEach(u => {
          if(u.includes('api') || u.includes('backend') || u.includes('graphql') || u.includes('cinesync')) {
            apis.add(u);
          }
        });
      }
    } catch(e) {}
  }
  console.log('Found potential APIs:');
  Array.from(apis).slice(0, 50).forEach(u => console.log(u));
}
scan();
