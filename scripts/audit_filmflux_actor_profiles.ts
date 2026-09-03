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

async function auditFilmFluxActorProfiles() {
  console.log('=== Fetching FilmFlux Sitemap Actor URLs ===');
  const sitemapRes = await fetch('https://filmflux.app/sitemap.xml', { headers: { 'user-agent': 'Mozilla/5.0' } });
  const xml = await sitemapRes.text();
  const allLocs = xml.match(/<loc>(.*?)<\/loc>/g) || [];
  const actorUrls = allLocs
    .map(m => m.replace(/<\/?loc>/g, ''))
    .filter(u => u.includes('/actor/'));

  console.log(`Total FilmFlux Actors in Sitemap: ${actorUrls.length}`);

  // Fetch all MuviDB people
  const ourPeople: any[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('people')
      .select('id, name, slug, bio, photo_url, date_of_birth')
      .range(from, from + 999);
    if (error || !data || data.length === 0) break;
    ourPeople.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  console.log(`Total MuviDB People: ${ourPeople.length}`);

  const ourNormMap = new Map<string, any>();
  for (const p of ourPeople) {
    ourNormMap.set(normalizeName(p.name), p);
    if (p.slug) ourNormMap.set(normalizeName(p.slug.replace(/-/g, ' ')), p);
  }

  // Sample 30 FilmFlux actors to parse their actual profile depth
  console.log('\n=== Sampling 30 FilmFlux Actor Profile Pages ===');
  const sampleUrls = actorUrls.slice(0, 30);
  const sampleResults: any[] = [];

  for (const url of sampleUrls) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);

      const slug = url.split('/actor/')[1]?.replace(/\/$/, '') || '';
      const rawName = slug.replace(/-/g, ' ');
      const norm = normalizeName(rawName);

      // Extract bio paragraph (usually 2nd paragraph or text containing is an actor/actress)
      let bioText = '';
      let dobText = '';

      $('p, div').each((_, el) => {
        const t = $(el).text().trim().replace(/\s+/g, ' ');
        if (!bioText && /is a (?:Nigerian|prominent|well-known|celebrated|rising) (?:actor|actress|filmmaker|producer|model)/i.test(t)) {
          bioText = t;
        }
        if (!dobText && /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i.test(t)) {
          const m = t.match(/\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/i);
          if (m) dobText = m[0];
        }
      });

      const ourRecord = ourNormMap.get(norm);

      sampleResults.push({
        name: rawName,
        url,
        filmflux: {
          hasBio: !!bioText,
          bioPreview: bioText ? bioText.slice(0, 80) + '...' : null,
          dob: dobText || null
        },
        muvidb: ourRecord ? {
          found: true,
          hasBio: !!ourRecord.bio,
          hasPhoto: !!ourRecord.photo_url,
          hasDob: !!ourRecord.date_of_birth
        } : {
          found: false
        }
      });
    } catch (e: any) {
      console.log(`Failed ${url}: ${e.message}`);
    }
  }

  console.log('\n=== Sample Findings (30 Actors) ===');
  let ffHasBio = 0;
  let ffHasDob = 0;
  let muviFound = 0;
  let muviMissingBioWhenFFHas = 0;

  for (const r of sampleResults) {
    if (r.filmflux.hasBio) ffHasBio++;
    if (r.filmflux.dob) ffHasDob++;
    if (r.muvidb.found) {
      muviFound++;
      if (r.filmflux.hasBio && !r.muvidb.hasBio) {
        muviMissingBioWhenFFHas++;
      }
    }
    console.log(`- Actor: "${r.name}"`);
    console.log(`    FilmFlux: Bio=${r.filmflux.hasBio ? '✓' : '✗'} | DOB=${r.filmflux.dob || 'None'}`);
    console.log(`    MuviDB: Found=${r.muvidb.found ? '✓' : '✗'} | Bio=${r.muvidb.hasBio ? '✓' : '✗'} | Photo=${r.muvidb.hasPhoto ? '✓' : '✗'} | DOB=${r.muvidb.hasDob ? '✓' : '✗'}`);
  }

  console.log('\n======================================================');
  console.log(`Sample Summary (out of ${sampleResults.length} actors):`);
  console.log(`FilmFlux has Bio: ${ffHasBio}/${sampleResults.length} (${((ffHasBio/sampleResults.length)*100).toFixed(0)}%)`);
  console.log(`FilmFlux has DOB: ${ffHasDob}/${sampleResults.length} (${((ffHasDob/sampleResults.length)*100).toFixed(0)}%)`);
  console.log(`Matched in MuviDB: ${muviFound}/${sampleResults.length} (${((muviFound/sampleResults.length)*100).toFixed(0)}%)`);
  console.log(`Enrichment Opportunity (FF has Bio, MuviDB missing): ${muviMissingBioWhenFFHas}/${muviFound}`);
  console.log('======================================================');

  process.exit(0);
}

auditFilmFluxActorProfiles().catch(err => {
  console.error(err);
  process.exit(1);
});
