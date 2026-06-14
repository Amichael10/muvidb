const fs = require('fs');

async function test() {
  const r = await fetch('https://ticketing.eu.veezi.com/sessions/?siteToken=ntfpkgyc0phrmzxb2ctk828vd4');
  const html = await r.text();
  const m = html.match(/<div[^>]+class="[^"]*\bfilm\b[^"]*"[^>]*>/ig);
  console.log(m ? m.join('\n') : 'no match');
}

test();
