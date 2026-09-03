import * as cheerio from 'cheerio';
import { supabase } from './lib/db.js';

async function probePlatforms() {
  console.log('=== 1. Probing BAP Productions (app.bapproduction.com & bapproduction.com) ===');
  const bapUrls = ['https://app.bapproduction.com', 'https://bapproduction.com', 'https://bapproduction.com/theatre'];
  for (const u of bapUrls) {
    try {
      const res = await fetch(u, {
        headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(10000)
      });
      console.log(`[BAP] ${u} -> Status: ${res.status}`);
      if (res.ok) {
        const text = await res.text();
        const $ = cheerio.load(text);
        const links: string[] = [];
        $('a[href]').each((_, el) => {
          const href = $(el).attr('href');
          if (href && (href.includes('production') || href.includes('theatre') || href.includes('show') || href.includes('play'))) {
            links.push(href);
          }
        });
        console.log(`[BAP] Found ${links.length} potential production links:`, Array.from(new Set(links)).slice(0, 10));
      }
    } catch (e: any) {
      console.log(`[BAP] ${u} failed: ${e.message}`);
    }
  }

  console.log('\n=== 2. Probing Terra Kulture (tickets.terrakulture.com) ===');
  try {
    const res = await fetch('https://tickets.terrakulture.com/tickets/events', {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[Terra Kulture] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const $ = cheerio.load(text);
      const events: { title: string; href: string }[] = [];
      $('a[href*="/events/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim();
        if (title && href) events.push({ title: title.replace(/\s+/g, ' '), href });
      });
      console.log(`[Terra Kulture] Found ${events.length} events:`, events);
    }
  } catch (e: any) {
    console.log(`[Terra Kulture] Failed: ${e.message}`);
  }

  console.log('\n=== 3. Probing Tix Africa (tix.africa) ===');
  try {
    const res = await fetch('https://api.tix.africa/api/v1/events?search=theatre&limit=20', {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[Tix Africa API] Status: ${res.status}`);
    if (res.ok) {
      const data = await res.json();
      console.log(`[Tix Africa API] Results:`, data?.data?.length || data?.length || data);
    } else {
      // try scraping public discover
      const discRes = await fetch('https://tix.africa/discover', {
        headers: { 'user-agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(10000)
      });
      console.log(`[Tix Africa Discover] Status: ${discRes.status}`);
      if (discRes.ok) {
        const dText = await discRes.text();
        const $ = cheerio.load(dText);
        const tixLinks: string[] = [];
        $('a[href*="/discover/"]').each((_, el) => {
          tixLinks.push($(el).attr('href') || '');
        });
        console.log(`[Tix Africa Discover] Found ${tixLinks.length} discover links:`, tixLinks.slice(0, 10));
      }
    }
  } catch (e: any) {
    console.log(`[Tix Africa] Failed: ${e.message}`);
  }

  console.log('\n=== 4. Probing Immersia Show (immersia.show) ===');
  try {
    const res = await fetch('https://www.immersia.show/', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[Immersia] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const $ = cheerio.load(text);
      const links: string[] = [];
      $('a[href*="showId="], a[href*="show-details"]').each((_, el) => {
        links.push($(el).attr('href') || '');
      });
      console.log(`[Immersia] Found show links:`, Array.from(new Set(links)));
    }
  } catch (e: any) {
    console.log(`[Immersia] Failed: ${e.message}`);
  }

  console.log('\n=== 5. Probing Shaw Theatre London (shaw-theatre.com) ===');
  try {
    const res = await fetch('https://shaw-theatre.com/whats-on', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[Shaw Theatre] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const $ = cheerio.load(text);
      const links: { title: string; href: string }[] = [];
      $('a[href*="/whats-on/"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        const title = $(el).text().trim();
        if (title && href && !href.endsWith('/whats-on')) {
          links.push({ title: title.replace(/\s+/g, ' '), href });
        }
      });
      console.log(`[Shaw Theatre] Found whats-on items:`, links);
    }
  } catch (e: any) {
    console.log(`[Shaw Theatre] Failed: ${e.message}`);
  }

  console.log('\n=== 6. Probing Alliance Francaise Lagos (afnigeria.org) ===');
  try {
    const res = await fetch('https://www.afnigeria.org/lagos/events/', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[Alliance Francaise] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const $ = cheerio.load(text);
      const events: string[] = [];
      $('h2, h3, a').each((_, el) => {
        const t = $(el).text().trim();
        if (t.toLowerCase().includes('theatre') || t.toLowerCase().includes('play') || t.toLowerCase().includes('stage') || t.toLowerCase().includes('musical')) {
          events.push(t);
        }
      });
      console.log(`[Alliance Francaise] Stage/Theatre items found:`, Array.from(new Set(events)));
    }
  } catch (e: any) {
    console.log(`[Alliance Francaise] Failed: ${e.message}`);
  }

  console.log('\n=== 7. Probing MUSON Centre (muson.org) ===');
  try {
    const res = await fetch('https://muson.org/events/', {
      headers: { 'user-agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000)
    });
    console.log(`[MUSON] Status: ${res.status}`);
    if (res.ok) {
      const text = await res.text();
      const $ = cheerio.load(text);
      const events: string[] = [];
      $('h2, h3, a').each((_, el) => {
        const t = $(el).text().trim();
        if (t.length > 5 && t.length < 80) events.push(t);
      });
      console.log(`[MUSON] Event items:`, Array.from(new Set(events)).slice(0, 10));
    }
  } catch (e: any) {
    console.log(`[MUSON] Failed: ${e.message}`);
  }

  process.exit(0);
}

probePlatforms().catch(e => {
  console.error(e);
  process.exit(1);
});
