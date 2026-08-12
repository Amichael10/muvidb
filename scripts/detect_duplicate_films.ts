import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { generateAIContent, parseJSON } from '../api/_lib/ai_service.js';

dotenv.config();

const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const limit = parseInt(process.env.LIMIT || '100', 10);

async function main() {
  console.log(`🔎 Auditing Film Database for Potential Duplicates (LIMIT=${limit})...\n`);

  const { data: films, error } = await sb
    .from('films')
    .select('id, title, year')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Database query error:', error.message);
    process.exit(1);
  }

  if (!films || films.length < 2) {
    console.log('✨ Not enough films to check!');
    return;
  }

  console.log(`Analyzing ${films.length} film titles for potential duplicate uploads...`);

  const prompt = `
    You are a database deduplication auditor for a Nollywood film database.
    Analyze these film titles and identify pairs that are VERY LIKELY the exact same film re-uploaded or typed differently.
    (e.g., "Alakada (Part 1)" vs "Alakada Pt 1", "Osuofia in London" vs "Osuofia in London 1").

    Return ONLY JSON: [{"original_id": "...", "original_title": "...", "duplicate_id": "...", "duplicate_title": "...", "confidence": 0.95, "reason": "..."}]

    Films: ${JSON.stringify(films)}
  `;

  const { text, telemetry } = await generateAIContent(prompt);
  console.log(`[AI Engine: ${telemetry?.engine || 'unknown'}] Analysis complete.\n`);

  const duplicates = parseJSON(text);
  if (!Array.isArray(duplicates) || duplicates.length === 0) {
    console.log('✨ Zero probable duplicate films detected!');
    return;
  }

  console.log(`Found ${duplicates.length} potential duplicate pair(s):\n`);

  for (const dup of duplicates) {
    console.log(`────────────────────────────────────────`);
    console.log(`🎬 Original : "${dup.original_title}" (${dup.original_id})`);
    console.log(`👯 Duplicate: "${dup.duplicate_title}" (${dup.duplicate_id})`);
    console.log(`🎯 Confidence Score: ${Math.round((dup.confidence || 0) * 100)}%`);
    console.log(`💡 Reason: ${dup.reason}`);
  }

  console.log(`\n══════════════════════════════════════════`);
  console.log(`🎉 Audit Complete. Inspect the recommendations above.`);
  console.log(`══════════════════════════════════════════`);
}

main().catch(console.error);
