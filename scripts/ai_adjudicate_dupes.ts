/**
 * AI adjudication of the remaining duplicate-people queue.
 *
 * The scanner's fuzzy bucket mixes OCR misreadings of ONE person with genuinely
 * DIFFERENT people who have similar names. Regex can't tell them apart, but a
 * model that knows Nollywood can:
 *    "Chinenye Nnebe" / "Chineye Nnebe"      -> same (OCR)
 *    "Odunlade Adekola" / "Odunayo Ademola"  -> different actors
 *
 * We don't ask the model to FIND duplicates (hallucination-prone). We hand it
 * the candidate groups the scanner already produced and ask only for a verdict,
 * then merge the confident "same" ones. Every returned name is validated against
 * the group before use, so the model can't invent people.
 *
 *   npx tsx scripts/ai_adjudicate_dupes.ts            # dry run
 *   npx tsx scripts/ai_adjudicate_dupes.ts --apply
 *   npx tsx scripts/ai_adjudicate_dupes.ts --apply --limit=200
 */
import { supabase } from './lib/db';
import { scanPeopleDuplicates } from '../src/lib/deduplicator.js';
// Use the shared AI service: it rotates all 4 GEMINI_API_KEY_n on 429 and falls
// back to OpenAI/Groq — a single raw client just dies on the first quota wall.
import { generateAIContent } from '../api/_lib/ai_service.js';
import { writeFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');
const LIMIT = Number((process.argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || 0);
const BATCH = 12;

// ── Safety net over the AI verdict ───────────────────────────────────────────
// The model is right ~94% of the time but still merges genuinely different
// Yoruba/Igbo surnames ("Adebayo"→"Adekola", "Ogundele"→"Ogundare"). Names only
// pass if the difference is plausibly an OCR artifact, not a real morpheme.
const foldName = (s: string) =>
  String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

function sim(a: string, b: string): number {
  if (a === b) return 1; const m = a.length, n = b.length; if (!m || !n) return 0;
  const d: number[] = Array(n + 1); for (let j = 0; j <= n; j++) d[j] = j;
  for (let i = 1; i <= m; i++) { let prev = d[0]; d[0] = i;
    for (let j = 1; j <= n; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return 1 - d[n] / Math.max(m, n);
}

function plausibleSameName(a: string, b: string): boolean {
  const A = foldName(a).split(' ').filter(Boolean);
  const B = foldName(b).split(' ').filter(Boolean);
  if (!A.length || !B.length) return false;
  // "Uche Nancy" vs "Uchenancy" / "Funmi Abidemi" vs "Funmi Abidemii" —
  // pure spacing or single-character OCR noise across the whole name.
  const ja = A.join(''), jb = B.join('');
  if (sim(ja, jb) >= 0.9) return true;
  // Different token counts: only the whole-string test can vouch for it.
  if (A.length !== B.length) return sim(ja, jb) >= 0.85;
  // EVERY token must independently match. Comparing only the longest token let
  // "Damilola Adebayo" ← "DAMILOLA ADEKOYA" through, because the identical
  // FIRST name was the longest and the surname was never checked.
  for (let i = 0; i < A.length; i++) if (sim(A[i], B[i]) < 0.78) return false;
  return true;
}

const completeness = (p: any) =>
  ['bio', 'photo_url', 'date_of_birth', 'nationality', 'tmdb_id', 'slug', 'gender']
    .reduce((n, k) => n + (p?.[k] ? 1 : 0), 0);

const PROMPT = `You are cleaning a Nollywood (Nigerian/Ghanaian) film credits database.
Each numbered GROUP below holds people records whose names look similar. They came from OCR of on-screen credit rolls, so misreadings are common (l/I/1, c/e, o/0, rn/m, dropped or doubled letters, stray punctuation).

For EACH group decide which names refer to the SAME real person.

CRITICAL RULES:
- Nigerian/Yoruba/Igbo names that differ in a real morpheme are DIFFERENT people:
  "Adeboye" vs "Adebola" vs "Adeyele" = different. "Odunlade Adekola" vs "Odunayo Ademola" = different.
- Only call names the same when the difference is plainly an OCR/spelling artifact of the SAME name.
- A nickname in parentheses does not make two different names the same person.
- If unsure, say different. A wrong merge is far worse than a missed one.
- "survivor" MUST be the best-spelled real name, copied EXACTLY from that group's list.
- "same" MUST list the OTHER names from that group that are the same person, copied EXACTLY. Omit any you're unsure about.

Return ONLY a JSON array, no prose:
[{"group":<number>,"survivor":"<exact name>","same":["<exact name>",...],"confident":true|false}]
If no names in a group are the same person, return "same":[] for it.

GROUPS:
`;

async function main() {
  let all: any[] = []; let from = 0;
  for (;;) {
    const { data, error } = await supabase.from('people').select('*').order('id').range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...data); if (data.length < 1000) break; from += 1000;
  }
  const report: any = scanPeopleDuplicates(all);
  const byId = new Map(all.map((p) => [p.id, p]));
  let groups = report.groups
    .filter((g: any) => g.confidence !== 'blocked')
    .map((g: any) => ({ id: g.id, members: (g.records || []).map((r: any) => byId.get(r.id)).filter(Boolean) }))
    .filter((g: any) => g.members.length >= 2 && g.members.length <= 12);
  if (LIMIT) groups = groups.slice(0, LIMIT);
  console.log(`candidate groups to adjudicate: ${groups.length}`);

  const plans: any[] = [];
  let sameCount = 0, diffCount = 0, aiFail = 0;
  const vetoedPairs: string[] = [];
  const dismissGroups: any[] = [];
  for (let i = 0; i < groups.length; i += BATCH) {
    const batch = groups.slice(i, i + BATCH);
    const listing = batch.map((g: any, n: number) =>
      `GROUP ${n + 1}:\n${g.members.map((m: any) => `  - ${m.name}`).join('\n')}`).join('\n\n');
    let parsed: any[] = [];
    let lastErr: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { text } = await generateAIContent(PROMPT + listing);
        const txt = String(text || '').replace(/```json|```/g, '').trim();
        parsed = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
        lastErr = null; break;
      } catch (e: any) { lastErr = e; await new Promise((r) => setTimeout(r, 12000 * (attempt + 1))); }
    }
    if (lastErr) { aiFail++; console.warn(`  batch ${i / BATCH + 1} AI error: ${String(lastErr.message).slice(0, 70)}`); continue; }

    for (const verdict of parsed) {
      const g = batch[Number(verdict.group) - 1];
      if (!g) { diffCount++; continue; }
      // Confidently NOT the same person -> dismiss the group so it leaves the
      // review queue for good (this is what actually drains the backlog).
      if (verdict.confident === true && Array.isArray(verdict.same) && verdict.same.length === 0) {
        dismissGroups.push(g); diffCount++; continue;
      }
      if (!verdict.confident || !Array.isArray(verdict.same) || !verdict.same.length) { diffCount++; continue; }
      // validate: every name must exist in THIS group (no hallucination)
      const byName = new Map(g.members.map((m: any) => [String(m.name).trim(), m]));
      const survivor = byName.get(String(verdict.survivor || '').trim());
      const dups = verdict.same.map((n: string) => byName.get(String(n).trim())).filter(Boolean);
      if (!survivor || !dups.length) { diffCount++; continue; }
      // Safety net: drop any the AI matched whose names aren't plausibly the same.
      const uniq = dups.filter((d: any) => d.id !== survivor.id && plausibleSameName(survivor.name, d.name));
      const vetoed = dups.filter((d: any) => d.id !== survivor.id && !plausibleSameName(survivor.name, d.name));
      for (const v of vetoed) vetoedPairs.push(`${survivor.name}  ✗  ${v.name}`);
      if (!uniq.length) { diffCount++; continue; }
      sameCount++;
      plans.push({ survivor, duplicates: uniq });
    }
    process.stdout.write(`\r  adjudicated ${Math.min(i + BATCH, groups.length)}/${groups.length}  merges=${sameCount} keep-separate=${diffCount}`);
  }
  console.log(`\n\nAI says SAME (mergeable): ${plans.length} groups, absorbing ${plans.reduce((n, p) => n + p.duplicates.length, 0)} records`);
  console.log(`AI says DIFFERENT / unsure (left alone): ${diffCount}   AI errors: ${aiFail}`);
  console.log(`CONFIDENTLY DIFFERENT -> dismissable groups: ${dismissGroups.length}`);
  console.log(`VETOED by name-plausibility guard: ${vetoedPairs.length}`);
  for (const v of vetoedPairs.slice(0, 10)) console.log(`    ${v}`);
  console.log('\nsamples:');
  for (const p of plans.slice(0, 12))
    console.log(`  KEEP ${JSON.stringify(p.survivor.name)} ← ${p.duplicates.map((d: any) => JSON.stringify(d.name)).join(' ')}`);

  writeFileSync('scratch/ai-adjudication.json', JSON.stringify(
    plans.map((p) => ({ survivor: p.survivor.name, survivorId: p.survivor.id, duplicates: p.duplicates.map((d: any) => ({ id: d.id, name: d.name })) })), null, 2));

  // Persist BOTH decisions before touching the DB. AI quota is the scarce
  // resource here — if a write fails we must be able to replay it without
  // paying for adjudication again.
  const dismissRows: any[] = [];
  for (const g of dismissGroups) {
    const ids = g.members.map((m: any) => m.id);
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        const [l, r] = [ids[a], ids[b]].sort();
        dismissRows.push({ entity_type: 'people', left_record_id: l, right_record_id: r, reason: 'AI adjudicated: separate people' });
      }
  }
  writeFileSync('scratch/ai-dismissals.json', JSON.stringify(dismissRows, null, 2));
  console.log(`dismiss plan saved: ${dismissRows.length} pairs from ${dismissGroups.length} groups -> scratch/ai-dismissals.json`);

  if (!APPLY) { console.log('\nDRY RUN — plans written to scratch/. Re-run with --apply.'); return; }

  // 1. Dismiss the confidently-different groups so they leave the review queue.
  let dis = 0, disFail = 0;
  for (let i = 0; i < dismissRows.length; i += 200) {
    const { error } = await supabase.from('dedupe_ignored_pairs')
      .upsert(dismissRows.slice(i, i + 200), { onConflict: 'entity_type,left_record_id,right_record_id' });
    if (error) { disFail++; console.warn(`  dismiss batch failed: ${String(error.message).slice(0, 80)}`); }
    else dis += Math.min(200, dismissRows.length - i);
  }
  console.log(`DISMISSED ${dis} pairs (${disFail} failed batches)`);

  let ok = 0, fail = 0;
  for (let i = 0; i < plans.length; i++) {
    const p = plans[i];
    const dupIds = p.duplicates.map((d: any) => d.id);
    await supabase.from('people').update({ mubi_slug: null }).in('id', dupIds);
    const { error } = await supabase.rpc('merge_people_group', { p_master_id: p.survivor.id, p_duplicate_ids: dupIds, p_metadata: {} });
    if (error) { fail++; console.warn(`  ❌ ${p.survivor.name}: ${String(error.message).slice(0, 70)}`); } else ok++;
    if ((i + 1) % 25 === 0 || i === plans.length - 1) console.log(`  ${i + 1}/${plans.length} (ok=${ok} fail=${fail})`);
  }
  console.log(`\nDone. ok=${ok} fail=${fail}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
