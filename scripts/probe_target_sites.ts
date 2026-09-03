import * as cheerio from 'cheerio';
import { supabase } from './lib/db.js';

async function probePlatforms() {
  const sites = [
    { name: 'PartyJollofTV', base: 'https://partyjolloftv.com', sitemaps: ['https://partyjolloftv.com/sitemap.xml', 'https://partyjolloftv.com/sitemap_index.xml'] },
    { name: 'Nollywood.com', base: 'https://nollywood.com', sitemaps: ['https://nollywood.com/sitemap.xml', 'https://nollywood.com/sitemap_index.xml', 'https://nollywood.com/post-sitemap.xml'] },
    { name: 'Nollywire', base: 'https://nollywire.com', sitemaps: ['https://nollywire.com/sitemap.xml', 'https://nollywire.com/sitemap_index.xml', 'https://nollywire.com/actor-sitemap.xml'] }
  ];

  console.log('================================================================');
  console.log('1. PROBING SITEMAPS & STRUCTURE OF TARGET SITES');
  console.log('================================================================');

  for (const site of sites) {
    console.log(`\n--- Probing ${site.name} (${site.base}) ---`);
    try {
      const homeRes = await fetch(site.base, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      });
      console.log(`[${site.name}] Homepage Status: ${homeRes.status}`);
      if (homeRes.ok) {
        const text = await homeRes.text();
        const $ = cheerio.load(text);
        console.log(`  Title: ${$('title').text().trim()}`);
        console.log(`  Meta Desc: ${$('meta[name="description"]').attr('content') || 'None'}`);
      }
    } catch (e: any) {
      console.log(`[${site.name}] Homepage failed: ${e.message}`);
    }

    for (const sm of site.sitemaps) {
      try {
        const smRes = await fetch(sm, {
          headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          signal: AbortSignal.timeout(10000)
        });
        console.log(`  [Sitemap] ${sm} -> Status: ${smRes.status}`);
        if (smRes.ok) {
          const xml = await smRes.text();
          const locs = (xml.match(/<loc>(.*?)<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
          console.log(`    Found ${locs.length} URLs in ${sm}`);
          const subSitemaps = locs.filter(u => u.includes('sitemap'));
          if (subSitemaps.length > 0) {
            console.log(`    Sub-sitemaps:`, subSitemaps);
          } else {
            console.log(`    Sample URLs:`, locs.slice(0, 5));
          }
        }
      } catch (e: any) {
        console.log(`  [Sitemap] ${sm} failed: ${e.message}`);
      }
    }
  }

  process.exit(0);
}

probePlatforms().catch(e => {
  console.error(e);
  process.exit(1);
});
