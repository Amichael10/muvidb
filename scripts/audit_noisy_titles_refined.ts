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
        .select('id, title, year, source, poster_url, youtube_watch_url, slug')
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

async function refineAudit() {
  const films = await fetchAllFilms();

  // Pattern categories:
  // 1. Titles with Actor lists appended (dashes, slashes, ellipses, "in <Movie>", "Starring")
  // 2. Titles with "Nollywood", "Nigerian Movie", "African Movie", "Yoruba Movie"
  // 3. Titles with "2026", "2025", "2024" tacked onto the end/middle
  // 4. Titles with "Latest", "Trending", "Full Movie", "Blockbuster", "Must Watch"
  // 5. Scraped caption titles like "Actor A, Actor B, and Actor C in FilmTitle"

  const actorListTackedOn: any[] = [];
  const nollywoodTagInTitle: any[] = [];
  const yearTagInTitle: any[] = [];
  const promoNoiseInTitle: any[] = [];
  const scrapedCaptionPattern: any[] = [];

  const actorListRegex = /[-–—/|•…\.]{1,}\s*(?:starring|feat|ft|with)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:\s*[,&/]\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)+)/i;
  const captionRegex = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+(?:,\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)*\s+(?:and|&)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s+in\s+/i;
  const nollywoodRegex = /\b(nollywood|nigerian movie|african movie|yoruba movie|igbo movie|hausa movie)\b/i;
  const yearRegex = /\b(202[3-7])\b/;
  const promoRegex = /\b(latest\s+nollywood|latest\s+movie|trending\s+movie|full\s+movie|blockbuster|must\s+watch|epic\s+movie|cinema\s+movie)\b/i;

  for (const f of films) {
    const t = f.title || '';
    if (captionRegex.test(t)) {
      scrapedCaptionPattern.push(f);
    } else if (actorListRegex.test(t)) {
      actorListTackedOn.push(f);
    }
    if (nollywoodRegex.test(t)) {
      nollywoodTagInTitle.push(f);
    }
    if (yearRegex.test(t) && !f.source?.includes('imdb')) {
      yearTagInTitle.push(f);
    }
    if (promoRegex.test(t)) {
      promoNoiseInTitle.push(f);
    }
  }

  console.log('=== REFINED AUDIT SUMMARY ===');
  console.log(`Total Films in DB: ${films.length}`);
  console.log(`1. Actor Names Appended to Title (e.g., "... - Zubby Michael, Destiny Etiko"): ${actorListTackedOn.length}`);
  console.log(`2. Scraped Caption Titles (e.g., "Actor A, Actor B in Title"): ${scrapedCaptionPattern.length}`);
  console.log(`3. Promotional Buzzwords (e.g., "Latest Movie", "Trending", "Full Movie"): ${promoNoiseInTitle.length}`);
  console.log(`4. "Nollywood" / "Nigerian Movie" Tag in Title: ${nollywoodTagInTitle.length}`);
  console.log(`5. Year Tags in Title (2024-2027) on YouTube/Manual Films: ${yearTagInTitle.length}`);

  console.log('\n--- Sample Scraped Captions (IMDb Artifacts) ---');
  for (const f of scrapedCaptionPattern.slice(0, 10)) {
    console.log(`  • "${f.title}" (ID: ${f.id})`);
  }

  console.log('\n--- Sample Actor Lists in Titles ---');
  for (const f of actorListTackedOn.slice(0, 10)) {
    console.log(`  • "${f.title}" (ID: ${f.id})`);
  }

  console.log('\n--- Sample Nollywood / Promo Titles ---');
  for (const f of promoNoiseInTitle.slice(0, 10)) {
    console.log(`  • "${f.title}" (ID: ${f.id})`);
  }
}

refineAudit().catch(console.error);
