import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateAIContent, parseJSON } from './ai_service.js';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Concurrently enrich films missing synopses right after a YouTube sync or film insertion.
 * Can take specific filmIds or automatically query recently added films missing synopses.
 */
export async function enrichMissingSynopsesConcurrent(filmIds?: string[]): Promise<number> {
  let filmsToEnrich: { id: string; title: string; year?: number | null }[] = [];

  try {
    if (filmIds && filmIds.length > 0) {
      const { data } = await supabase
        .from('films')
        .select('id, title, year, synopsis')
        .in('id', filmIds)
        .or('synopsis.is.null,synopsis.eq.');
      filmsToEnrich = data || [];
    } else {
      const { data } = await supabase
        .from('films')
        .select('id, title, year, synopsis')
        .or('synopsis.is.null,synopsis.eq.')
        .order('created_at', { ascending: false })
        .limit(20);
      filmsToEnrich = data || [];
    }
  } catch (err: any) {
    console.error('[cohere_enrichment] Error fetching films:', err.message);
    return 0;
  }

  if (!filmsToEnrich.length) {
    return 0;
  }

  console.log(`[Cohere Sync] Generating film synopses concurrently for ${filmsToEnrich.length} films...`);

  const prompt = `
    You are a Nollywood database editor. Write a concise, 2-sentence factual movie logline for each film below.
    Base the summary ONLY on the title and context. Keep tone cinematic and objective.

    Return ONLY JSON array: [{"id": "...", "title": "...", "synopsis": "..."}]

    Films: ${JSON.stringify(filmsToEnrich.map(f => ({ id: f.id, title: f.title, year: f.year })))}
  `;

  let updatedCount = 0;
  try {
    const { text, telemetry } = await generateAIContent(prompt, { preferredProvider: 'cohere' });
    const parsed = parseJSON(text);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.id && item.synopsis && item.synopsis.trim().length > 15) {
          const { error } = await supabase
            .from('films')
            .update({ 
              synopsis: item.synopsis.trim(),
              needs_review: false 
            })
            .eq('id', item.id);

          if (!error) {
            updatedCount++;
          }
        }
      }
    }
    console.log(`[Cohere Sync] ✅ Updated ${updatedCount}/${filmsToEnrich.length} film synopses using engine: ${telemetry.engine}`);
  } catch (err: any) {
    console.warn(`[Cohere Sync] ⚠️ Synopsis generation failed: ${err.message}`);
  }

  return updatedCount;
}

/**
 * Daily backfill function for actor/crew profiles missing bios using Cohere.
 */
export async function backfillActorBiosDaily(batchLimit: number = 25): Promise<number> {
  console.log(`[Cohere Sync] Starting daily actor bio backfill (limit: ${batchLimit})...`);

  let people: { id: string; name: string; bio?: string | null }[] = [];
  try {
    const { data } = await supabase
      .from('people')
      .select('id, name, bio, film_count')
      .or('bio.is.null,bio.eq.')
      .order('film_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(batchLimit);
    people = data || [];
  } catch (err: any) {
    console.error('[cohere_enrichment] Error fetching people:', err.message);
    return 0;
  }

  if (!people.length) {
    console.log('[Cohere Sync] No people found missing bios.');
    return 0;
  }

  // Gather movie credits context for each person
  const personContexts = [];
  for (const p of people) {
    const { data: credits } = await supabase
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

    Return ONLY JSON array: [{"id": "...", "name": "...", "biography": "..."}]

    People: ${JSON.stringify(personContexts)}
  `;

  let updatedCount = 0;
  try {
    const { text, telemetry } = await generateAIContent(prompt, { preferredProvider: 'cohere' });
    const parsed = parseJSON(text);

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item.id && item.biography && item.biography.trim().length > 15) {
          const { error } = await supabase
            .from('people')
            .update({ bio: item.biography.trim() })
            .eq('id', item.id);

          if (!error) {
            updatedCount++;
          }
        }
      }
    }
    console.log(`[Cohere Sync] ✅ Daily bio backfill complete. Updated ${updatedCount}/${people.length} profiles using engine: ${telemetry.engine}`);
  } catch (err: any) {
    console.warn(`[Cohere Sync] ⚠️ Actor bio backfill failed: ${err.message}`);
  }

  return updatedCount;
}
