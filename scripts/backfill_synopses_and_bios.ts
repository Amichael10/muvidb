import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateAIContent, parseJSON } from '../api/_lib/ai_service.js';

dotenv.config();

const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const BATCH_SIZE = 25;
const DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillSynopses() {
  console.log('\n==================================================');
  console.log('🎬 STARTING FILM SYNOPSES BACKFILL...');
  console.log('==================================================\n');

  let totalUpdated = 0;
  let batchNum = 1;
  let emptyBatchesInARow = 0;

  while (emptyBatchesInARow < 3) {
    let films: any[] = [];
    try {
      const { data, error } = await sb
        .from('films')
        .select('id, title, year, synopsis')
        .or('synopsis.is.null,synopsis.eq.')
        .order('created_at', { ascending: false })
        .limit(BATCH_SIZE);

      if (error) {
        console.error('❌ Error fetching films:', error.message);
        await sleep(5000);
        continue;
      }
      films = data || [];
    } catch (dbErr: any) {
      console.error('❌ Database fetch exception:', dbErr.message);
      await sleep(5000);
      continue;
    }

    if (!films.length) {
      emptyBatchesInARow++;
      console.log(`🎉 No films missing synopses found (check ${emptyBatchesInARow}/3)...`);
      await sleep(3000);
      continue;
    }

    emptyBatchesInARow = 0;
    console.log(`[Batch ${batchNum}] Processing ${films.length} films missing synopses...`);

    const prompt = `
      You are a Nollywood database editor. Write a concise, 2-sentence factual movie logline for each film below.
      Base the summary ONLY on the title and context (e.g. genre implied by title). Do NOT make up specific character names unless evident. Keep tone cinematic.

      Return ONLY JSON: [{"id": "...", "title": "...", "synopsis": "..."}]

      Films: ${JSON.stringify(films.map((f) => ({ id: f.id, title: f.title, year: f.year })))}
    `;

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { text, telemetry } = await generateAIContent(prompt);
        const parsed = parseJSON(text);

        let batchUpdated = 0;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.id && item.synopsis && item.synopsis.length > 15) {
              const { error: uErr } = await sb
                .from('films')
                .update({ synopsis: item.synopsis.trim() })
                .eq('id', item.id);

              if (!uErr) {
                batchUpdated++;
                totalUpdated++;
              }
            }
          }
        }
        console.log(`  ✅ Updated ${batchUpdated}/${films.length} films. Total synopses updated so far: ${totalUpdated}`);
        success = true;
        break;
      } catch (err: any) {
        console.warn(`  ⚠️ Attempt ${attempt}/3 failed: ${err.message}. Retrying in 5s...`);
        await sleep(5000);
      }
    }

    if (!success) {
      console.error(`  ❌ Batch ${batchNum} failed all attempts, skipping batch items for now.`);
    }

    batchNum++;
    await sleep(DELAY_MS);
  }

  console.log(`\n🎉 Synopses backfill complete! Total films updated: ${totalUpdated}\n`);
}

async function backfillBios() {
  console.log('\n==================================================');
  console.log('👤 STARTING ACTOR/CREW BIOS BACKFILL...');
  console.log('==================================================\n');

  let totalUpdated = 0;
  let batchNum = 1;
  let emptyBatchesInARow = 0;

  while (emptyBatchesInARow < 3) {
    let people: any[] = [];
    try {
      const { data, error } = await sb
        .from('people')
        .select('id, name, bio')
        .or('bio.is.null,bio.eq.')
        .order('created_at', { ascending: false })
        .limit(BATCH_SIZE);

      if (error) {
        console.error('❌ Error fetching people:', error.message);
        await sleep(5000);
        continue;
      }
      people = data || [];
    } catch (dbErr: any) {
      console.error('❌ Database fetch exception:', dbErr.message);
      await sleep(5000);
      continue;
    }

    if (!people.length) {
      emptyBatchesInARow++;
      console.log(`🎉 No people missing bios found (check ${emptyBatchesInARow}/3)...`);
      await sleep(3000);
      continue;
    }

    emptyBatchesInARow = 0;
    console.log(`[Batch ${batchNum}] Processing ${people.length} people missing bios...`);

    const personContexts = [];
    for (const p of people) {
      const { data: credits } = await sb
        .from('credits')
        .select('films(title)')
        .eq('person_id', p.id)
        .limit(5);

      const movieTitles = (credits || []).map((c: any) => c.films?.title).filter(Boolean);
      personContexts.push({
        id: p.id,
        name: p.name,
        knownForMovies: movieTitles,
      });
    }

    const prompt = `
      You are a Nollywood database biographer. Write a 2-3 sentence professional biography for each person below.
      Highlight their contributions to African cinema and mention their notable movie appearances if listed.

      Return ONLY JSON: [{"id": "...", "name": "...", "biography": "..."}]

      People: ${JSON.stringify(personContexts)}
    `;

    let success = false;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const { text, telemetry } = await generateAIContent(prompt);
        const parsed = parseJSON(text);

        let batchUpdated = 0;
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.id && item.biography && item.biography.length > 15) {
              const { error: uErr } = await sb
                .from('people')
                .update({ bio: item.biography.trim() })
                .eq('id', item.id);

              if (!uErr) {
                batchUpdated++;
                totalUpdated++;
              }
            }
          }
        }
        console.log(`  ✅ Updated ${batchUpdated}/${people.length} bios. Total bios updated so far: ${totalUpdated}`);
        success = true;
        break;
      } catch (err: any) {
        console.warn(`  ⚠️ Attempt ${attempt}/3 failed: ${err.message}. Retrying in 5s...`);
        await sleep(5000);
      }
    }

    if (!success) {
      console.error(`  ❌ Batch ${batchNum} failed all attempts, skipping batch items for now.`);
    }

    batchNum++;
    await sleep(DELAY_MS);
  }

  console.log(`\n🎉 Bios backfill complete! Total profiles updated: ${totalUpdated}\n`);
}

async function main() {
  await backfillSynopses();
  await backfillBios();
}

main().catch(console.error);
