import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateAIContent, parseJSON } from '../api/_lib/ai_service.js';

dotenv.config();

const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const isDryRun = process.env.DRY_RUN !== 'false';
const limit = parseInt(process.env.LIMIT || '15', 10);

async function main() {
  console.log(`👤 Auto-Generating Missing Actor Bios (DRY_RUN=${isDryRun}, LIMIT=${limit})...\n`);

  const { data: people, error } = await sb
    .from('people')
    .select('id, name, bio')
    .or('bio.is.null,bio.eq.')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Database query error:', error.message);
    process.exit(1);
  }

  if (!people || people.length === 0) {
    console.log('✨ No people missing bios found!');
    return;
  }

  console.log(`Found ${people.length} people missing bios. Fetching credit history context...`);

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

  console.log(`Sending batch to AI...`);

  const prompt = `
    You are a Nollywood database biographer. Write a 2-3 sentence professional biography for each person below.
    Highlight their contributions to African cinema and mention their notable movie appearances if listed.

    Return ONLY JSON: [{"id": "...", "name": "...", "biography": "..."}]

    People: ${JSON.stringify(personContexts)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  console.log(`[AI Engine: ${telemetry?.engine || 'unknown'}] Response received.`);

  const parsed = parseJSON(text);
  if (!Array.isArray(parsed)) {
    console.error('Failed to parse AI response as array:', text);
    return;
  }

  let count = 0;
  for (const item of parsed) {
    if (!item.id || !item.biography) continue;

    console.log(`\n────────────────────────────────────────`);
    console.log(`👤 ${item.name || item.id}`);
    console.log(`📜 ${item.biography}`);

    if (!isDryRun) {
      const { error: updateErr } = await sb
        .from('people')
        .update({ bio: item.biography.trim() })
        .eq('id', item.id);

      if (updateErr) {
        console.error(`   ❌ Failed to update DB: ${updateErr.message}`);
      } else {
        console.log(`   ✅ DB updated successfully`);
        count++;
      }
    }
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`🎉 Done! ${isDryRun ? 'Dry Run complete (no DB changes made).' : `Updated ${count} biographies.`}`);
  console.log(`══════════════════════════════════════════`);
}

main().catch(console.error);
