const fs = require('fs');

async function check() {
  const r = await fetch('https://filmhouseng.com/en/buy-tickets');
  const t = await r.text();
  const links = [...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  console.log(Array.from(new Set(links)).filter(l => l.includes('cinema') || l.includes('movie')).join('\n'));
}

check();
