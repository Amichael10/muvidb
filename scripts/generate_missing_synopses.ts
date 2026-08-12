import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateAIContent, parseJSON } from '../api/_lib/ai_service.js';

dotenv.config();

const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const isDryRun = process.env.DRY_RUN !== 'false';
const limit = parseInt(process.env.LIMIT || '20', 10);

async function main() {
  console.log(`🎬 Auto-Generating Missing Film Synopses (DRY_RUN=${isDryRun}, LIMIT=${limit})...\n`);

  const { data: films, error } = await sb
    .from('films')
    .select('id, title, year, synopsis')
    .or('synopsis.is.null,synopsis.eq.')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Database query error:', error.message);
    process.exit(1);
  }

  if (!films || films.length === 0) {
    console.log('✨ No films missing synopses found!');
    return;
  }

  console.log(`Found ${films.length} films missing synopses. Sending batch to AI...`);

  const prompt = `
    You are a Nollywood database editor. Write a concise, 2-sentence factual movie logline for each film below.
    Base the summary ONLY on the title and context (e.g. genre implied by title). Do NOT make up specific character names unless evident. Keep tone cinematic.

    Return ONLY JSON: [{"id": "...", "title": "...", "synopsis": "..."}]

    Films: ${JSON.stringify(films.map(f => ({ id: f.id, title: f.title, year: f.year })))}
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
    if (!item.id || !item.synopsis) continue;

    console.log(`\n────────────────────────────────────────`);
    console.log(`🎬 ${item.title || item.id}`);
    console.log(`📝 ${item.synopsis}`);

    if (!isDryRun) {
      const { error: updateErr } = await sb
        .from('films')
        .update({ synopsis: item.synopsis.trim() })
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
  console.log(`🎉 Done! ${isDryRun ? 'Dry Run complete (no DB changes made).' : `Updated ${count} film synopses.`}`);
  console.log(`══════════════════════════════════════════`);
}

main().catch(console.error);
