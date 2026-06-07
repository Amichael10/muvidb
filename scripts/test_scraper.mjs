// Quick sanity test — process 3 Nigerian films end-to-end
import * as cheerio from 'cheerio';

const PJ_BASE = 'https://www.partyjolloftv.com';
const PROXY_USER = 'smart-n84gqsupfojn';
const PROXY_PASS = 'cumaxLcBt96dj0Wp';
const proxyAuth = Buffer.from(`${PROXY_USER}:${PROXY_PASS}`).toString('base64');

async function fetchJSON(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Accept': 'application/json',
      'Proxy-Authorization': `Basic ${proxyAuth}`,
    }
  });
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      'Proxy-Authorization': `Basic ${proxyAuth}`,
    }
  });
  return res.text();
}

// 1) Get 3 Nigerian films
const list = await fetchJSON(`${PJ_BASE}/api/movies?where[countryOfOrigin][equals]=NG&limit=3&page=1`);
console.log(`\n✅ Got ${list.docs.length} films. Total NG films: ${list.totalDocs}`);

for (const doc of list.docs) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`🎬 Film: ${doc.title} (ID: ${doc.id}, Country: ${doc.countryOfOrigin})`);

  // 2) Get full detail
  const detail = await fetchJSON(`${PJ_BASE}/api/movies/${doc.id}`);
  console.log(`   Synopsis: ${detail.overview ? detail.overview.substring(0, 80) + '...' : '(none)'}`);
  console.log(`   Poster: ${detail.poster?.url || '(none)'}`);
  console.log(`   Cast count: ${detail.cast?.length || 0}`);
  console.log(`   Crew count: ${detail.crew?.length || 0}`);
  console.log(`   PJ Slug: ${detail.slug}`);

  // 3) Get people from HTML
  const html = await fetchText(`${PJ_BASE}/movies/${detail.slug}`);
  const $ = cheerio.load(html);
  const people = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href.match(/^\/people\/[a-z0-9-]+$/)) {
      const slug = href.replace('/people/', '');
      const name = $(el).text().trim();
      if (slug && !people.find(p => p.slug === slug)) people.push({ slug, name });
    }
  });
  console.log(`   People in HTML: ${people.length}`);
  people.slice(0, 5).forEach(p => console.log(`     - ${p.name} → /people/${p.slug}`));

  // 4) Scrape first person
  if (people.length > 0) {
    const personHtml = await fetchText(`${PJ_BASE}/people/${people[0].slug}`);
    const $p = cheerio.load(personHtml);
    const personName = $p('meta[property="og:title"]').attr('content')?.replace(' | PartyJollof TV', '').trim();
    const personPhoto = $p('meta[property="og:image"]').attr('content');
    const personBio = $p('meta[property="og:description"]').attr('content')?.trim();
    console.log(`\n   👤 First person: ${personName}`);
    console.log(`   Photo: ${personPhoto ? '✅ found' : '❌ none'}`);
    console.log(`   Bio: ${personBio ? personBio.substring(0, 80) + '...' : '(none)'}`);
  }
}

console.log('\n\n✅ Sanity check complete!');
