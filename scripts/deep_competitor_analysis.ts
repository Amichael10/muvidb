import * as cheerio from 'cheerio';
import { supabase } from './lib/db.js';

function normalizeName(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function deepAudit() {
  console.log('================================================================');
  console.log('1. DEEP DIVE: PARTYJOLLOF TV (partyjolloftv.com)');
  console.log('================================================================');

  const pjSubmaps = [
    'https://partyjolloftv.com/sitemaps/movies.xml',
    'https://partyjolloftv.com/sitemaps/people.xml',
    'https://partyjolloftv.com/sitemaps/shows.xml',
    'https://partyjolloftv.com/sitemaps/cinemas.xml',
    'https://partyjolloftv.com/sitemaps/awards.xml'
  ];

  const pjCounts: Record<string, number> = {};
  let pjPeopleUrls: string[] = [];
  let pjMovieUrls: string[] = [];

  for (const sm of pjSubmaps) {
    try {
      const res = await fetch(sm, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const xml = await res.text();
        const locs = (xml.match(/<loc>(.*?)<\/loc>/g) || []).map(l => l.replace(/<\/?loc>/g, ''));
        const key = sm.split('/').pop()?.replace('.xml', '') || sm;
        pjCounts[key] = locs.length;
        if (key === 'people') pjPeopleUrls = locs;
        if (key === 'movies') pjMovieUrls = locs;
      }
    } catch (e: any) {
      console.log(`Failed ${sm}: ${e.message}`);
    }
  }

  console.log('PartyJollof TV Catalog Counts:', pjCounts);

  // Inspect 3 sample actor pages on PartyJollof TV
  console.log('\n--- Sample PartyJollof TV Actor Profiles ---');
  for (const url of pjPeopleUrls.slice(0, 4)) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const name = $('h1').first().text().trim() || $('title').text().split('|')[0].trim();
        const bio = $('p.bio, .biography, p').filter((_, el) => $(el).text().length > 50).first().text().trim().replace(/\s+/g, ' ');
        const img = $('img').first().attr('src');
        console.log(`[PartyJollof Profile] ${name} (${url})`);
        console.log(`  Bio: ${bio ? bio.slice(0, 100) + '...' : 'None'}`);
        console.log(`  Image: ${img || 'None'}`);
      }
    } catch (e: any) {
      console.log(`Failed ${url}: ${e.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('2. DEEP DIVE: NOLLYWOOD.COM (nollywood.com)');
  console.log('================================================================');
  const nollycomUrls = [
    'https://nollywood.com/movies',
    'https://nollywood.com/actors',
    'https://nollywood.com/people',
    'https://nollywood.com/directory'
  ];

  for (const url of nollycomUrls) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      console.log(`[Nollywood.com] ${url} -> Status: ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        console.log(`  Title: ${$('title').text()}`);
        const text = $('body').text().replace(/\s+/g, ' ');
        const counts = text.match(/\d+[\d,]*\s+(?:movies|actors|people|titles|films|reviews)/gi) || [];
        console.log(`  Counts mentioned on page:`, Array.from(new Set(counts)).slice(0, 8));
        const links: string[] = [];
        $('a[href*="/actor/"], a[href*="/movie/"], a[href*="/person/"]').each((_, el) => {
          links.push($(el).attr('href') || '');
        });
        console.log(`  Profile links found on ${url}: ${links.length}`);
        if (links.length > 0) {
          console.log(`    Sample:`, links.slice(0, 5));
        }
      }
    } catch (e: any) {
      console.log(`Failed ${url}: ${e.message}`);
    }
  }

  console.log('\n================================================================');
  console.log('3. DEEP DIVE: NOLLYWIRE (nollywire.com)');
  console.log('================================================================');
  const nollywireUrls = [
    'https://nollywire.com',
    'https://nollywire.com/films',
    'https://nollywire.com/actors',
    'https://nollywire.com/showtimes'
  ];

  for (const url of nollywireUrls) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
      console.log(`[Nollywire] ${url} -> Status: ${res.status}`);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        console.log(`  Title: ${$('title').text()}`);
        const text = $('body').text().replace(/\s+/g, ' ');
        const counts = text.match(/\d+[\d,]*\s+(?:movies|actors|people|titles|films|cinemas)/gi) || [];
        console.log(`  Counts mentioned:`, Array.from(new Set(counts)).slice(0, 8));
        const links: string[] = [];
        $('a[href*="/film/"], a[href*="/actor/"], a[href*="/person/"], a[href*="/showtimes/"]').each((_, el) => {
          links.push($(el).attr('href') || '');
        });
        console.log(`  Links found on ${url}: ${links.length}`);
        if (links.length > 0) {
          console.log(`    Sample:`, links.slice(0, 5));
        }
      }
    } catch (e: any) {
      console.log(`Failed ${url}: ${e.message}`);
    }
  }

  process.exit(0);
}

deepAudit().catch(e => {
  console.error(e);
  process.exit(1);
});
