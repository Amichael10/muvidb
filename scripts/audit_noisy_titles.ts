import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { supabase } from './lib/db';

async function fetchAllFilms() {
  const pageSize = 1000;
  const batches = [];
  for (let i = 0; i < 26; i++) {
    batches.push(
      supabase
        .from('films')
        .select('id, title, year, source, poster_url, youtube_watch_url, is_nollywood')
        .range(i * pageSize, (i + 1) * pageSize - 1)
    );
  }
  const results = await Promise.all(batches);
  const allFilms: any[] = [];
  for (const r of results) {
    if (r.data) allFilms.push(...r.data);
  }
  return allFilms;
}

async function main() {
  console.log('🔍 Fetching all films from database to audit noisy titles...');
  const films = await fetchAllFilms();
  console.log(`Loaded ${films.length} films.`);

  // Regex patterns
  const nollywoodRegex = /\b(nollywood|nolly\b|nigerian movie|african movie|yoruba movie|igbo movie|hausa movie)\b/i;
  const year2026Regex = /\b(202[4-7])\b/;
  const starringRegex = /\b(starring|featuring|ft\.?|feat\.?|with|staring)\b/i;
  const promoNoiseRegex = /\b(latest|trending|full movie|blockbuster|epic movie|hit movie|must watch|exclusive|cinema movie|part\s*\d+|season\s*\d+|episode\s*\d+)\b/i;

  // Let's also fetch top actor names from DB to see if actor names are in titles
  const { data: topActors } = await supabase
    .from('people')
    .select('name')
    .order('film_count', { ascending: false })
    .limit(300);

  const actorNames = (topActors || [])
    .map(p => p.name?.trim())
    .filter(name => name && name.length > 3 && !['Love', 'King', 'Queen', 'Prince', 'Princess', 'Destiny', 'Mercy', 'Patience', 'Grace', 'Faith', 'Hope', 'Joy', 'Blessing', 'Peace', 'Diamond', 'Angel', 'Gold', 'Silver', 'Star', 'Junior', 'Senior', 'Black', 'White', 'Brown', 'Green'].includes(name));

  const categorized = {
    containsNollywood: [] as any[],
    contains2026OrRecentYear: [] as any[],
    containsStarringOrCast: [] as any[],
    containsPromoNoise: [] as any[],
    containsKnownActorNameInTitle: [] as any[],
    totalNoisy: [] as any[],
  };

  const noisySet = new Set<string>();

  for (const f of films) {
    const title = f.title || '';
    let isNoisy = false;
    const reasons: string[] = [];

    if (nollywoodRegex.test(title)) {
      categorized.containsNollywood.push(f);
      reasons.push('Nollywood/African keyword');
      isNoisy = true;
    }

    if (year2026Regex.test(title)) {
      categorized.contains2026OrRecentYear.push(f);
      reasons.push('Year in title (2024-2027)');
      isNoisy = true;
    }

    if (starringRegex.test(title)) {
      categorized.containsStarringOrCast.push(f);
      reasons.push('Starring/Featuring tag');
      isNoisy = true;
    }

    if (promoNoiseRegex.test(title)) {
      categorized.containsPromoNoise.push(f);
      reasons.push('Promo keywords (Latest/Trending/Part)');
      isNoisy = true;
    }

    // Check if title has dash or brackets containing known actor names
    let matchedActor = '';
    for (const actor of actorNames) {
      // Check if actor full name (e.g. "Zubby Michael", "Destiny Etiko", "Maurice Sam", "Ruth Kadiri") is in the title
      if (actor.includes(' ') && title.toLowerCase().includes(actor.toLowerCase())) {
        matchedActor = actor;
        break;
      }
    }

    if (matchedActor) {
      categorized.containsKnownActorNameInTitle.push({ film: f, actor: matchedActor });
      reasons.push(`Contains Actor: ${matchedActor}`);
      isNoisy = true;
    }

    if (isNoisy) {
      if (!noisySet.has(f.id)) {
        noisySet.add(f.id);
        categorized.totalNoisy.push({ film: f, reasons, title });
      }
    }
  }

  console.log('\n================ AUDIT REPORT ================\n');
  console.log(`Total Films Scanned: ${films.length}`);
  console.log(`Total Films with Noisy Titles: ${categorized.totalNoisy.length} (${((categorized.totalNoisy.length / films.length) * 100).toFixed(1)}%)\n`);

  console.log(` Breakdown by Pattern:`);
  console.log(`  1. Contains "Nollywood" / "Nigerian Movie": ${categorized.containsNollywood.length}`);
  console.log(`  2. Contains Year (2024-2027 / 2026): ${categorized.contains2026OrRecentYear.length}`);
  console.log(`  3. Contains "Starring" / "Featuring": ${categorized.containsStarringOrCast.length}`);
  console.log(`  4. Contains Promo Noise ("Latest", "Trending", "Full Movie", "Part X"): ${categorized.containsPromoNoise.length}`);
  console.log(`  5. Contains Top Actor Full Names (e.g. Ruth Kadiri, Zubby Michael, Maurice Sam): ${categorized.containsKnownActorNameInTitle.length}`);

  console.log('\n--- Sample 25 Noisy Titles Detected ---');
  for (const item of categorized.totalNoisy.slice(0, 25)) {
    console.log(`• ID: ${item.film.id}`);
    console.log(`  Current Title: "${item.title}"`);
    console.log(`  Source: ${item.film.source || 'N/A'} | Year: ${item.film.year || 'N/A'}`);
    console.log(`  Detected Flags: [${item.reasons.join(', ')}]`);
    console.log('---');
  }

  // Save full list to scratch file for inspection
  const fs = await import('node:fs');
  fs.writeFileSync(
    'scratch/noisy_titles_audit.json',
    JSON.stringify(
      {
        totalScanned: films.length,
        totalNoisy: categorized.totalNoisy.length,
        breakdown: {
          containsNollywood: categorized.containsNollywood.length,
          contains2026OrRecentYear: categorized.contains2026OrRecentYear.length,
          containsStarringOrCast: categorized.containsStarringOrCast.length,
          containsPromoNoise: categorized.containsPromoNoise.length,
          containsKnownActorNameInTitle: categorized.containsKnownActorNameInTitle.length,
        },
        sample: categorized.totalNoisy.slice(0, 100).map(t => ({
          id: t.film.id,
          title: t.title,
          source: t.film.source,
          reasons: t.reasons,
        })),
      },
      null,
      2
    )
  );

  console.log('\nDetailed sample saved to scratch/noisy_titles_audit.json');
}

main().catch(console.error);
